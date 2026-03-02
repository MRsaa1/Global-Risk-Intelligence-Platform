// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "APISyncModule.h"
#include "Modules/ModuleManager.h"

void FAPISyncModule::StartupModule()
{
    UE_LOG(LogTemp, Log, TEXT("APISync module loaded"));
}

void FAPISyncModule::ShutdownModule()
{
    UE_LOG(LogTemp, Log, TEXT("APISync module unloaded"));
}

IMPLEMENT_MODULE(FAPISyncModule, APISync);
