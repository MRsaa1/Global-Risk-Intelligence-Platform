// Copyright (c) 2026 SAA Platform. All rights reserved.
#pragma once
#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class FRiskUIModule : public IModuleInterface
{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
};
