// Copyright (c) 2026 SAA Platform. All rights reserved.

using UnrealBuildTool;

public class Simulation : ModuleRules
{
    public Simulation(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "APISync",
            "Niagara",
            "PhysicsCore",
            "Chaos",
            "GeometryCollectionEngine",
            "ProceduralMeshComponent"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "RenderCore",
            "RHI"
        });

        PublicIncludePaths.AddRange(new string[]
        {
            "Simulation/Public"
        });

        PrivateIncludePaths.AddRange(new string[]
        {
            "Simulation/Private"
        });
    }
}
