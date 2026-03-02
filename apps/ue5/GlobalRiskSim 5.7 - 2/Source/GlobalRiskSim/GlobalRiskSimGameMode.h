// Copyright (c) 2026 SAA Platform. All rights reserved.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GlobalRiskSimGameMode.generated.h"

/**
 * Default game mode for Global Risk Simulation.
 * Sets up the default pawn, HUD, and player controller.
 */
UCLASS()
class GLOBALRISKSIM_API AGlobalRiskSimGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AGlobalRiskSimGameMode();
};
