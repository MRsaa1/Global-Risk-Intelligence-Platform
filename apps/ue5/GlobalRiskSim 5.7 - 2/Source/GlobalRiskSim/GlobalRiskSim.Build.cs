// Copyright (c) 2026 SAA Platform. All rights reserved.

using UnrealBuildTool;

public class GlobalRiskSim : ModuleRules
{
    public GlobalRiskSim(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore",
            "APISync",
            "Simulation",
            "RiskUI"
        });

        if (Target.bBuildEditor || Target.Platform == UnrealTargetPlatform.Mac || Target.Platform == UnrealTargetPlatform.Win64)
        {
            PublicDependencyModuleNames.Add("CesiumRuntime");
        }

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "Slate",
            "SlateCore",
            "UMG"
        });
    }
}
