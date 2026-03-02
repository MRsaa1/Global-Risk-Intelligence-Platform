// Copyright (c) 2026 SAA Platform. All rights reserved.

using UnrealBuildTool;

public class RiskUI : ModuleRules
{
    public RiskUI(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore",
            "UMG",
            "Slate",
            "SlateCore",
            "APISync",
            "MovieRenderPipelineCore",
            "LevelSequence"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "MovieRenderPipelineRenderPasses",
            "MovieRenderPipelineSettings"
        });

        PublicIncludePaths.AddRange(new string[]
        {
            "UI/Public"
        });

        PrivateIncludePaths.AddRange(new string[]
        {
            "UI/Private"
        });
    }
}
