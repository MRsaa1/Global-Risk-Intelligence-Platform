// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "SimulationModule.h"
#include "Modules/ModuleManager.h"

void FSimulationModule::StartupModule()
{
    UE_LOG(LogTemp, Log, TEXT("Simulation module loaded"));
}

void FSimulationModule::ShutdownModule()
{
    UE_LOG(LogTemp, Log, TEXT("Simulation module unloaded"));
}

IMPLEMENT_MODULE(FSimulationModule, Simulation);
