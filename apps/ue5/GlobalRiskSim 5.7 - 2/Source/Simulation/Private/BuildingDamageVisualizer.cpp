// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "BuildingDamageVisualizer.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/PlayerController.h"
#include "Materials/MaterialInstanceDynamic.h"


DEFINE_LOG_CATEGORY(LogBuildingVis);

ABuildingDamageVisualizer::ABuildingDamageVisualizer()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = 0.1f; // 10 Hz for LOD checks
}

void ABuildingDamageVisualizer::BeginPlay()
{
    Super::BeginPlay();
    UE_LOG(LogBuildingVis, Log, TEXT("BuildingDamageVisualizer ready"));
}

void ABuildingDamageVisualizer::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // Update camera altitude for LOD
    APlayerController* PC = UGameplayStatics::GetPlayerController(GetWorld(), 0);
    if (PC && PC->GetPawn())
    {
        CameraAltitudeM = PC->GetPawn()->GetActorLocation().Z / 100.0f; // cm to m
    }

    UpdateLODVisibility();

    // Cascade failure animation
    if (bCascadeActive && CascadeSequence.Num() > 0)
    {
        CascadeTimer += DeltaTime;
        if (CascadeTimer >= CascadeDelay && CascadeIndex < CascadeSequence.Num())
        {
            CascadeTimer = 0.0f;
            const FString& FailedId = CascadeSequence[CascadeIndex];

            // Find the link and set it to failed
            for (FInfraLink& Link : InfraLinks)
            {
                if (Link.ToId == FailedId || Link.FromId == FailedId)
                {
                    Link.Status = TEXT("failed");
                    if (Link.LinkMaterial)
                    {
                        Link.LinkMaterial->SetVectorParameterValue(FName(TEXT("LinkColor")), LinkFailed);
                    }
                }
            }

            UE_LOG(LogBuildingVis, Log, TEXT("Cascade failure: %s (step %d/%d)"),
                *FailedId, CascadeIndex + 1, CascadeSequence.Num());

            CascadeIndex++;
            if (CascadeIndex >= CascadeSequence.Num())
            {
                bCascadeActive = false;
            }
        }
    }
}

// ============================================================================
// Data handlers
// ============================================================================

void ABuildingDamageVisualizer::OnBuildingDamageReceived(const TArray<FBuildingDamage>& Buildings)
{
    ClearBuildingOverlays();

    for (const FBuildingDamage& B : Buildings)
    {
        CreateBuildingOverlay(B);
    }

    UE_LOG(LogBuildingVis, Log, TEXT("Created %d building overlays"), BuildingOverlays.Num());
}

void ABuildingDamageVisualizer::OnInfrastructureReceived(const TArray<FInfrastructureItem>& Items)
{
    ClearInfraLinks();
    CachedInfraItems = Items;

    // Build dependency links
    TMap<FString, const FInfrastructureItem*> ItemMap;
    for (const FInfrastructureItem& Item : CachedInfraItems)
    {
        ItemMap.Add(Item.ItemId, &Item);
    }

    for (const FInfrastructureItem& Item : CachedInfraItems)
    {
        for (const FString& DepId : Item.DependsOn)
        {
            const FInfrastructureItem** DepItem = ItemMap.Find(DepId);
            if (DepItem)
            {
                CreateInfraLink(**DepItem, Item);
            }
        }
    }

    UE_LOG(LogBuildingVis, Log, TEXT("Created %d infrastructure dependency links"), InfraLinks.Num());
}

// ============================================================================
// Building overlay creation
// ============================================================================

void ABuildingDamageVisualizer::CreateBuildingOverlay(const FBuildingDamage& Building)
{
    FBuildingOverlay Overlay;
    Overlay.BuildingId = Building.BuildingId;

    const FVector WorldPos = GeoToWorld(
        Building.Location.Latitude,
        Building.Location.Longitude,
        0.0);

    // Create damage indicator: a small colored column at the building location
    UProceduralMeshComponent* MeshComp = NewObject<UProceduralMeshComponent>(this);
    MeshComp->SetupAttachment(GetRootComponent());
    MeshComp->RegisterComponent();

    // Simple box mesh representing building footprint
    const float HalfSize = 500.0f; // 5m half-size in cm
    const float Height = Building.Floors * 300.0f; // 3m per floor in cm
    const FLinearColor DmgColor = GetColorForDamage(Building.DamageRatio);

    TArray<FVector> Verts;
    TArray<int32> Tris;
    TArray<FVector> Norms;
    TArray<FVector2D> UVs;
    TArray<FLinearColor> Colors;

    // 8 vertices of a box
    const FVector Corners[8] = {
        WorldPos + FVector(-HalfSize, -HalfSize, 0),
        WorldPos + FVector( HalfSize, -HalfSize, 0),
        WorldPos + FVector( HalfSize,  HalfSize, 0),
        WorldPos + FVector(-HalfSize,  HalfSize, 0),
        WorldPos + FVector(-HalfSize, -HalfSize, Height),
        WorldPos + FVector( HalfSize, -HalfSize, Height),
        WorldPos + FVector( HalfSize,  HalfSize, Height),
        WorldPos + FVector(-HalfSize,  HalfSize, Height),
    };

    for (int32 i = 0; i < 8; i++)
    {
        Verts.Add(Corners[i]);
        Norms.Add(FVector::UpVector);
        UVs.Add(FVector2D(0, 0));
        Colors.Add(DmgColor);
    }

    // Top face
    Tris.Append({4, 5, 6}); Tris.Append({4, 6, 7});
    // Front face
    Tris.Append({0, 4, 5}); Tris.Append({0, 5, 1});
    // Right face
    Tris.Append({1, 5, 6}); Tris.Append({1, 6, 2});
    // Back face
    Tris.Append({2, 6, 7}); Tris.Append({2, 7, 3});
    // Left face
    Tris.Append({3, 7, 4}); Tris.Append({3, 4, 0});

    MeshComp->CreateMeshSection_LinearColor(0, Verts, Tris, Norms, UVs, Colors,
        TArray<FProcMeshTangent>(), false);

    // Apply material
    if (DamageOverlayMaterial)
    {
        UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(DamageOverlayMaterial, this);
        Mat->SetVectorParameterValue(FName(TEXT("DamageColor")), DmgColor);
        Mat->SetScalarParameterValue(FName(TEXT("DamageRatio")), Building.DamageRatio);
        MeshComp->SetMaterial(0, Mat);
        Overlay.DamageMaterial = Mat;
    }

    MeshComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Overlay.DamageOverlay = MeshComp;

    // Create water line if building is flooded
    if (Building.FloodDepthM > 0.01f)
    {
        CreateWaterLine(Overlay, Building);
    }

    BuildingOverlays.Add(Overlay);
}

void ABuildingDamageVisualizer::CreateWaterLine(FBuildingOverlay& Overlay, const FBuildingDamage& Building)
{
    const FVector WorldPos = GeoToWorld(
        Building.Location.Latitude,
        Building.Location.Longitude,
        0.0);

    UProceduralMeshComponent* WaterComp = NewObject<UProceduralMeshComponent>(this);
    WaterComp->SetupAttachment(GetRootComponent());
    WaterComp->RegisterComponent();

    // Ring around the building at flood depth
    const float WaterHeightCm = Building.FloodDepthM * 100.0f;
    const float Radius = 700.0f; // slightly larger than building
    const float Thickness = 50.0f;
    const int32 Segments = 32;

    TArray<FVector> Verts;
    TArray<int32> Tris;
    TArray<FVector> Norms;
    TArray<FVector2D> UVs;
    TArray<FLinearColor> Colors;

    const FLinearColor WaterColor(0.1f, 0.3f, 0.9f, 0.6f);

    for (int32 i = 0; i <= Segments; i++)
    {
        const float Angle = (float)i / Segments * 2.0f * PI;
        const float Cos = FMath::Cos(Angle);
        const float Sin = FMath::Sin(Angle);

        // Outer vertex
        Verts.Add(WorldPos + FVector(Cos * (Radius + Thickness), Sin * (Radius + Thickness), WaterHeightCm));
        // Inner vertex
        Verts.Add(WorldPos + FVector(Cos * Radius, Sin * Radius, WaterHeightCm));

        Norms.Add(FVector::UpVector);
        Norms.Add(FVector::UpVector);
        UVs.Add(FVector2D((float)i / Segments, 0.0f));
        UVs.Add(FVector2D((float)i / Segments, 1.0f));
        Colors.Add(WaterColor);
        Colors.Add(WaterColor);

        if (i > 0)
        {
            const int32 Base = (i - 1) * 2;
            Tris.Append({Base, Base + 2, Base + 3});
            Tris.Append({Base, Base + 3, Base + 1});
        }
    }

    WaterComp->CreateMeshSection_LinearColor(0, Verts, Tris, Norms, UVs, Colors,
        TArray<FProcMeshTangent>(), false);

    if (WaterLineMaterial)
    {
        UMaterialInstanceDynamic* WMat = UMaterialInstanceDynamic::Create(WaterLineMaterial, this);
        WMat->SetVectorParameterValue(FName(TEXT("WaterColor")), WaterColor);
        WMat->SetScalarParameterValue(FName(TEXT("FloodDepth")), Building.FloodDepthM);
        WaterComp->SetMaterial(0, WMat);
    }

    WaterComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Overlay.WaterLine = WaterComp;
}

// ============================================================================
// Infrastructure links
// ============================================================================

void ABuildingDamageVisualizer::CreateInfraLink(const FInfrastructureItem& From, const FInfrastructureItem& To)
{
    const FVector StartPos = GeoToWorld(From.Location.Latitude, From.Location.Longitude, 50.0);
    const FVector EndPos = GeoToWorld(To.Location.Latitude, To.Location.Longitude, 50.0);

    // Determine status based on structural integrity
    FString Status;
    FLinearColor Color;
    if (To.StructuralIntegrity >= 0.7f)
    {
        Status = TEXT("operational");
        Color = LinkOperational;
    }
    else if (To.StructuralIntegrity >= 0.3f)
    {
        Status = TEXT("degraded");
        Color = LinkDegraded;
    }
    else
    {
        Status = TEXT("failed");
        Color = LinkFailed;
    }

    // Create spline mesh between the two points
    USplineMeshComponent* SplineComp = NewObject<USplineMeshComponent>(this);
    SplineComp->SetupAttachment(GetRootComponent());
    SplineComp->SetStartAndEnd(StartPos, FVector::UpVector * 5000.0f,
                                EndPos, FVector::UpVector * 5000.0f);
    SplineComp->RegisterComponent();

    UMaterialInstanceDynamic* Mat = nullptr;
    if (InfraLinkMaterial)
    {
        Mat = UMaterialInstanceDynamic::Create(InfraLinkMaterial, this);
        Mat->SetVectorParameterValue(FName(TEXT("LinkColor")), Color);
        SplineComp->SetMaterial(0, Mat);
    }

    FInfraLink Link;
    Link.FromId = From.ItemId;
    Link.ToId = To.ItemId;
    Link.SplineMesh = SplineComp;
    Link.LinkMaterial = Mat;
    Link.Status = Status;
    InfraLinks.Add(Link);
}

// ============================================================================
// LOD visibility
// ============================================================================

void ABuildingDamageVisualizer::UpdateLODVisibility()
{
    const bool bShowBuildings = CameraAltitudeM < BuildingDetailAltitude;

    for (FBuildingOverlay& Overlay : BuildingOverlays)
    {
        if (Overlay.DamageOverlay)
            Overlay.DamageOverlay->SetVisibility(bShowBuildings);
        if (Overlay.WaterLine)
            Overlay.WaterLine->SetVisibility(bShowBuildings);
    }

    for (FInfraLink& Link : InfraLinks)
    {
        if (Link.SplineMesh)
            Link.SplineMesh->SetVisibility(bShowBuildings);
    }
}

// ============================================================================
// Cascade failure animation
// ============================================================================

void ABuildingDamageVisualizer::AnimateCascadeFailure(const TArray<FString>& FailureSequence, float DelayBetweenSeconds)
{
    CascadeSequence = FailureSequence;
    CascadeIndex = 0;
    CascadeTimer = 0.0f;
    CascadeDelay = FMath::Max(0.1f, DelayBetweenSeconds);
    bCascadeActive = true;

    // Reset all links to operational
    for (FInfraLink& Link : InfraLinks)
    {
        Link.Status = TEXT("operational");
        if (Link.LinkMaterial)
        {
            Link.LinkMaterial->SetVectorParameterValue(FName(TEXT("LinkColor")), LinkOperational);
        }
    }

    UE_LOG(LogBuildingVis, Log, TEXT("Starting cascade failure: %d steps, %.1fs delay"),
        CascadeSequence.Num(), CascadeDelay);
}

// ============================================================================
// Helpers
// ============================================================================

void ABuildingDamageVisualizer::ClearBuildingOverlays()
{
    for (FBuildingOverlay& Overlay : BuildingOverlays)
    {
        if (Overlay.DamageOverlay) Overlay.DamageOverlay->DestroyComponent();
        if (Overlay.WaterLine) Overlay.WaterLine->DestroyComponent();
    }
    BuildingOverlays.Empty();
}

void ABuildingDamageVisualizer::ClearInfraLinks()
{
    for (FInfraLink& Link : InfraLinks)
    {
        if (Link.SplineMesh) Link.SplineMesh->DestroyComponent();
    }
    InfraLinks.Empty();
}

FLinearColor ABuildingDamageVisualizer::GetColorForDamage(float DamageRatio) const
{
    DamageRatio = FMath::Clamp(DamageRatio, 0.0f, 1.0f);

    if (DamageRatio <= 0.25f)
        return FMath::Lerp(ColorNoDamage, ColorModerateDamage, DamageRatio * 4.0f);
    if (DamageRatio <= 0.75f)
        return FMath::Lerp(ColorModerateDamage, ColorSevereDamage, (DamageRatio - 0.25f) * 2.0f);
    return FMath::Lerp(ColorSevereDamage, ColorDestroyed, (DamageRatio - 0.75f) * 4.0f);
}

FVector ABuildingDamageVisualizer::GeoToWorld(double Lat, double Lng, double HeightM) const
{
    // Planar projection (cm). Use CesiumGeoreference when plugin enabled.
    return FVector(Lng * 111320.0 * 100.0, Lat * 110540.0 * 100.0, HeightM * 100.0);
}
