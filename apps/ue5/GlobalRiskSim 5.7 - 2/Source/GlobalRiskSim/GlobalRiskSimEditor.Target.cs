// Copyright (c) 2026 SAA Platform. All rights reserved.

using UnrealBuildTool;
using System.Collections.Generic;

public class GlobalRiskSimEditorTarget : TargetRules
{
    public GlobalRiskSimEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V6;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;
        ExtraModuleNames.AddRange(new string[] { "GlobalRiskSim", "APISync", "Simulation", "RiskUI" });
    }
}
