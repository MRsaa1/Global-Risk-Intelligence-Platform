"""
Stress Testing Workflow Engine

Manages approval workflows, scheduling, and governance for stress testing.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from enum import Enum
import structlog
from dataclasses import dataclass, field
from uuid import uuid4

logger = structlog.get_logger(__name__)


class WorkflowStatus(Enum):
    """Workflow status."""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ApprovalStatus(Enum):
    """Approval status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass
class WorkflowStep:
    """Workflow step."""
    step_id: str
    step_name: str
    step_type: str  # "approval", "calculation", "review", "submission"
    required_approvers: List[str]
    current_approvers: List[str] = field(default_factory=list)
    status: ApprovalStatus = ApprovalStatus.PENDING
    due_date: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Workflow:
    """Workflow definition."""
    workflow_id: str
    name: str
    description: str
    workflow_type: str  # "ccar", "dfast", "eba", "custom"
    steps: List[WorkflowStep]
    status: WorkflowStatus = WorkflowStatus.DRAFT
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class WorkflowEngine:
    """
    Stress Testing Workflow Engine.
    
    Manages approval workflows, scheduling, and governance.
    """

    def __init__(self):
        """Initialize workflow engine."""
        self.workflows: Dict[str, Workflow] = {}
        self.approval_chains: Dict[str, List[str]] = {}
        self.scheduled_tasks: Dict[str, Dict[str, Any]] = {}

    def create_workflow(
        self,
        name: str,
        description: str,
        workflow_type: str,
        steps: List[Dict[str, Any]],
        created_by: str,
    ) -> str:
        """
        Create new workflow.

        Args:
            name: Workflow name
            description: Workflow description
            workflow_type: Type of workflow
            steps: List of step definitions
            created_by: Creator user ID

        Returns:
            Workflow ID
        """
        workflow_id = str(uuid4())

        workflow_steps = []
        for step_def in steps:
            step = WorkflowStep(
                step_id=str(uuid4()),
                step_name=step_def["name"],
                step_type=step_def["type"],
                required_approvers=step_def.get("approvers", []),
            )
            workflow_steps.append(step)

        workflow = Workflow(
            workflow_id=workflow_id,
            name=name,
            description=description,
            workflow_type=workflow_type,
            steps=workflow_steps,
            created_by=created_by,
        )

        self.workflows[workflow_id] = workflow
        logger.info("Workflow created", workflow_id=workflow_id, name=name)

        return workflow_id

    def submit_for_approval(
        self,
        workflow_id: str,
        submitted_by: str,
    ) -> None:
        """
        Submit workflow for approval.

        Args:
            workflow_id: Workflow ID
            submitted_by: User submitting
        """
        if workflow_id not in self.workflows:
            raise ValueError(f"Workflow {workflow_id} not found")

        workflow = self.workflows[workflow_id]
        
        if workflow.status != WorkflowStatus.DRAFT:
            raise ValueError(f"Workflow {workflow_id} is not in draft status")

        workflow.status = WorkflowStatus.PENDING_APPROVAL
        
        # Set first step as pending
        if workflow.steps:
            workflow.steps[0].status = ApprovalStatus.PENDING

        logger.info(
            "Workflow submitted for approval",
            workflow_id=workflow_id,
            submitted_by=submitted_by,
        )

    def approve_step(
        self,
        workflow_id: str,
        step_id: str,
        approver: str,
        comments: Optional[str] = None,
    ) -> None:
        """
        Approve workflow step.

        Args:
            workflow_id: Workflow ID
            step_id: Step ID
            approver: Approver user ID
            comments: Optional comments
        """
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        step = next((s for s in workflow.steps if s.step_id == step_id), None)
        if not step:
            raise ValueError(f"Step {step_id} not found")

        if approver not in step.required_approvers:
            raise ValueError(f"User {approver} is not authorized to approve this step")

        if approver not in step.current_approvers:
            step.current_approvers.append(approver)

        # Check if all approvers have approved
        if set(step.current_approvers) == set(step.required_approvers):
            step.status = ApprovalStatus.APPROVED
            
            # Move to next step or complete workflow
            self._advance_workflow(workflow_id)

        logger.info(
            "Workflow step approved",
            workflow_id=workflow_id,
            step_id=step_id,
            approver=approver,
        )

    def reject_step(
        self,
        workflow_id: str,
        step_id: str,
        approver: str,
        reason: str,
    ) -> None:
        """
        Reject workflow step.

        Args:
            workflow_id: Workflow ID
            step_id: Step ID
            approver: Approver user ID
            reason: Rejection reason
        """
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        step = next((s for s in workflow.steps if s.step_id == step_id), None)
        if not step:
            raise ValueError(f"Step {step_id} not found")

        step.status = ApprovalStatus.REJECTED
        workflow.status = WorkflowStatus.REJECTED
        step.metadata["rejection_reason"] = reason
        step.metadata["rejected_by"] = approver
        step.metadata["rejected_at"] = datetime.now().isoformat()

        logger.warning(
            "Workflow step rejected",
            workflow_id=workflow_id,
            step_id=step_id,
            approver=approver,
            reason=reason,
        )

    def _advance_workflow(self, workflow_id: str) -> None:
        """Advance workflow to next step."""
        workflow = self.workflows[workflow_id]
        
        # Find current step
        current_step_idx = None
        for i, step in enumerate(workflow.steps):
            if step.status == ApprovalStatus.PENDING:
                current_step_idx = i
                break

        if current_step_idx is None:
            # All steps approved, complete workflow
            workflow.status = WorkflowStatus.APPROVED
            logger.info("Workflow approved", workflow_id=workflow_id)
        else:
            # Move to next step
            next_step_idx = current_step_idx + 1
            if next_step_idx < len(workflow.steps):
                workflow.steps[next_step_idx].status = ApprovalStatus.PENDING
                logger.info(
                    "Workflow advanced to next step",
                    workflow_id=workflow_id,
                    next_step=workflow.steps[next_step_idx].step_name,
                )

    def schedule_calculation(
        self,
        workflow_id: str,
        calculation_config: Dict[str, Any],
        scheduled_time: datetime,
    ) -> str:
        """
        Schedule calculation.

        Args:
            workflow_id: Workflow ID
            calculation_config: Calculation configuration
            scheduled_time: Scheduled execution time

        Returns:
            Task ID
        """
        task_id = str(uuid4())

        self.scheduled_tasks[task_id] = {
            "task_id": task_id,
            "workflow_id": workflow_id,
            "calculation_config": calculation_config,
            "scheduled_time": scheduled_time,
            "status": "scheduled",
            "created_at": datetime.now().isoformat(),
        }

        logger.info(
            "Calculation scheduled",
            task_id=task_id,
            workflow_id=workflow_id,
            scheduled_time=scheduled_time.isoformat(),
        )

        return task_id

    def get_workflow_status(self, workflow_id: str) -> Dict[str, Any]:
        """
        Get workflow status.

        Args:
            workflow_id: Workflow ID

        Returns:
            Workflow status information
        """
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        return {
            "workflow_id": workflow.workflow_id,
            "name": workflow.name,
            "status": workflow.status.value,
            "steps": [
                {
                    "step_id": step.step_id,
                    "step_name": step.step_name,
                    "step_type": step.step_type,
                    "status": step.status.value,
                    "required_approvers": step.required_approvers,
                    "current_approvers": step.current_approvers,
                }
                for step in workflow.steps
            ],
            "created_by": workflow.created_by,
            "created_at": workflow.created_at.isoformat(),
            "completed_at": workflow.completed_at.isoformat() if workflow.completed_at else None,
        }

    def get_pending_approvals(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get pending approvals for user.

        Args:
            user_id: User ID

        Returns:
            List of pending approvals
        """
        pending = []

        for workflow_id, workflow in self.workflows.items():
            if workflow.status != WorkflowStatus.PENDING_APPROVAL:
                continue

            for step in workflow.steps:
                if (
                    step.status == ApprovalStatus.PENDING
                    and user_id in step.required_approvers
                    and user_id not in step.current_approvers
                ):
                    pending.append({
                        "workflow_id": workflow_id,
                        "workflow_name": workflow.name,
                        "step_id": step.step_id,
                        "step_name": step.step_name,
                        "due_date": step.due_date.isoformat() if step.due_date else None,
                    })

        return pending


# Pre-configured workflows
def create_ccar_workflow(created_by: str) -> str:
    """Create CCAR workflow."""
    engine = WorkflowEngine()
    
    steps = [
        {
            "name": "Scenario Review",
            "type": "approval",
            "approvers": ["risk_manager", "cfo"],
        },
        {
            "name": "Calculation Execution",
            "type": "calculation",
            "approvers": [],
        },
        {
            "name": "Results Review",
            "type": "review",
            "approvers": ["risk_manager", "cfo", "ceo"],
        },
        {
            "name": "Regulatory Submission",
            "type": "submission",
            "approvers": ["cfo", "ceo"],
        },
    ]

    return engine.create_workflow(
        name="CCAR Stress Test 2024",
        description="Comprehensive Capital Analysis and Review",
        workflow_type="ccar",
        steps=steps,
        created_by=created_by,
    )

