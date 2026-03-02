// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "GlobalRiskSim.h"
#include "Modules/ModuleManager.h"

void FGlobalRiskSimModule::StartupModule()
{
    UE_LOG(LogTemp, Log, TEXT("GlobalRiskSim module started"));
}

void FGlobalRiskSimModule::ShutdownModule()
{
    UE_LOG(LogTemp, Log, TEXT("GlobalRiskSim module shut down"));
}

IMPLEMENT_PRIMARY_GAME_MODULE(FGlobalRiskSimModule, GlobalRiskSim, "GlobalRiskSim");
