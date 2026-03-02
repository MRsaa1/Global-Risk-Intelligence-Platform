// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "RiskUIModule.h"
#include "Modules/ModuleManager.h"

void FRiskUIModule::StartupModule()
{
    UE_LOG(LogTemp, Log, TEXT("RiskUI module loaded"));
}

void FRiskUIModule::ShutdownModule()
{
    UE_LOG(LogTemp, Log, TEXT("RiskUI module unloaded"));
}

IMPLEMENT_MODULE(FRiskUIModule, RiskUI);
