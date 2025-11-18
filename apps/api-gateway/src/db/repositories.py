"""
Repository pattern for database operations.
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from apps.api_gateway.src.db.models import (
    Scenario,
    Calculation,
    Portfolio,
    User,
    ScenarioStatus,
    CalculationStatus,
)


class ScenarioRepository:
    """Repository for scenario operations."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, scenario_data: dict) -> Scenario:
        """Create a new scenario."""
        scenario = Scenario(**scenario_data)
        self.db.add(scenario)
        self.db.commit()
        self.db.refresh(scenario)
        return scenario

    def get_by_id(self, scenario_id: str) -> Optional[Scenario]:
        """Get scenario by ID."""
        return self.db.query(Scenario).filter(Scenario.scenario_id == scenario_id).first()

    def list(self, skip: int = 0, limit: int = 100) -> List[Scenario]:
        """List scenarios."""
        return self.db.query(Scenario).offset(skip).limit(limit).all()

    def update(self, scenario_id: str, scenario_data: dict) -> Optional[Scenario]:
        """Update scenario."""
        scenario = self.get_by_id(scenario_id)
        if scenario:
            for key, value in scenario_data.items():
                setattr(scenario, key, value)
            self.db.commit()
            self.db.refresh(scenario)
        return scenario

    def delete(self, scenario_id: str) -> bool:
        """Delete scenario."""
        scenario = self.get_by_id(scenario_id)
        if scenario:
            self.db.delete(scenario)
            self.db.commit()
            return True
        return False


class CalculationRepository:
    """Repository for calculation operations."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, calculation_data: dict) -> Calculation:
        """Create a new calculation."""
        calculation = Calculation(**calculation_data)
        self.db.add(calculation)
        self.db.commit()
        self.db.refresh(calculation)
        return calculation

    def get_by_id(self, calculation_id: str) -> Optional[Calculation]:
        """Get calculation by ID."""
        return (
            self.db.query(Calculation)
            .filter(Calculation.calculation_id == calculation_id)
            .first()
        )

    def list(
        self,
        skip: int = 0,
        limit: int = 100,
        scenario_id: Optional[str] = None,
        status: Optional[CalculationStatus] = None,
    ) -> List[Calculation]:
        """List calculations with optional filters."""
        query = self.db.query(Calculation)
        if scenario_id:
            query = query.filter(Calculation.scenario_id == scenario_id)
        if status:
            query = query.filter(Calculation.status == status)
        return query.offset(skip).limit(limit).all()

    def update(self, calculation_id: str, calculation_data: dict) -> Optional[Calculation]:
        """Update calculation."""
        calculation = self.get_by_id(calculation_id)
        if calculation:
            for key, value in calculation_data.items():
                setattr(calculation, key, value)
            self.db.commit()
            self.db.refresh(calculation)
        return calculation

    def update_status(
        self, calculation_id: str, status: CalculationStatus, **kwargs
    ) -> Optional[Calculation]:
        """Update calculation status."""
        update_data = {"status": status, **kwargs}
        return self.update(calculation_id, update_data)


class PortfolioRepository:
    """Repository for portfolio operations."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, portfolio_data: dict) -> Portfolio:
        """Create a new portfolio."""
        portfolio = Portfolio(**portfolio_data)
        self.db.add(portfolio)
        self.db.commit()
        self.db.refresh(portfolio)
        return portfolio

    def get_by_id(self, portfolio_id: str) -> Optional[Portfolio]:
        """Get portfolio by ID."""
        return (
            self.db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
        )

    def list(self, skip: int = 0, limit: int = 100) -> List[Portfolio]:
        """List portfolios."""
        return self.db.query(Portfolio).offset(skip).limit(limit).all()

    def update(self, portfolio_id: str, portfolio_data: dict) -> Optional[Portfolio]:
        """Update portfolio."""
        portfolio = self.get_by_id(portfolio_id)
        if portfolio:
            for key, value in portfolio_data.items():
                setattr(portfolio, key, value)
            self.db.commit()
            self.db.refresh(portfolio)
        return portfolio


class UserRepository:
    """Repository for user operations."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, user_data: dict) -> User:
        """Create a new user."""
        user = User(**user_data)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        return self.db.query(User).filter(User.user_id == user_id).first()

    def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        return self.db.query(User).filter(User.username == username).first()

    def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        return self.db.query(User).filter(User.email == email).first()

