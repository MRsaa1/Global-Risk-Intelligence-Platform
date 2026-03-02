// Copyright (c) 2026 SAA Platform. All rights reserved.

using UnrealBuildTool;

public class APISync : ModuleRules
{
    public APISync(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "HTTP",
            "Json",
            "JsonUtilities"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "WebSockets"
        });

        PublicIncludePaths.AddRange(new string[]
        {
            "APISync/Public"
        });

        PrivateIncludePaths.AddRange(new string[]
        {
            "APISync/Private"
        });
    }
}
