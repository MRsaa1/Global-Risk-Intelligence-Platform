"""Tests for NeMo Customizer and RL/Gym services."""


class TestNeMoCustomizer:
    def test_run_fine_tune_mock(self):
        from src.services.nemo_customizer import nemo_customizer
        result = nemo_customizer.run_fine_tune(
            dataset_id="test_ds", base_model="test_model", epochs=2, task="risk_analysis",
        )
        assert result.status == "mock"
        assert result.model_id.startswith("mock_ft_")
        assert result.metrics.get("loss") is not None

    def test_create_job(self):
        from src.services.nemo_customizer import nemo_customizer
        job = nemo_customizer.create_job(dataset_id="test_ds", epochs=1)
        assert "job_id" in job
        assert job["status"] == "completed"

    def test_model_registry(self):
        from src.services.nemo_customizer import nemo_customizer
        nemo_customizer.run_fine_tune(dataset_id="reg_test", epochs=1)
        models = nemo_customizer.list_models()
        assert len(models) > 0
        assert any("reg_test" in m["model_id"] for m in models)

    def test_job_list(self):
        from src.services.nemo_customizer import nemo_customizer
        jobs = nemo_customizer.list_jobs()
        assert isinstance(jobs, list)


class TestNeMoRLGym:
    def test_gym_reset(self):
        from src.services.nemo_rl_gym import stress_test_gym
        state = stress_test_gym.reset()
        assert state.step == 0
        assert state.scenario_type == "flood"

    def test_gym_step(self):
        from src.services.nemo_rl_gym import stress_test_gym, GymAction
        state = stress_test_gym.reset()
        action = GymAction("run_simulation", {"severity": 0.7, "scenario_type": "heat"})
        result = stress_test_gym.step(state, action)
        assert result.reward > 0
        assert result.state.step == 1
        assert "risk_reduction" in result.info

    def test_gym_episode(self):
        from src.services.nemo_rl_gym import stress_test_gym, GymAction
        state = stress_test_gym.reset()
        total_reward = 0
        for i in range(10):
            action = GymAction("run_simulation", {"severity": 0.5})
            result = stress_test_gym.step(state, action)
            total_reward += result.reward
            state = result.state
            if result.done:
                break
        assert total_reward > 0
        assert result.done is True

    def test_rl_experiment(self):
        from src.services.nemo_rl_gym import nemo_rl_service
        result = nemo_rl_service.run_advisor_policy_experiment(episodes=5)
        assert result.status == "mock"
        assert result.avg_reward > 0

    def test_generate_scenarios(self):
        from src.services.nemo_rl_gym import stress_test_gym
        scenarios = stress_test_gym.generate_scenarios(count=20)
        assert len(scenarios) == 20
        assert all("type" in s for s in scenarios)
