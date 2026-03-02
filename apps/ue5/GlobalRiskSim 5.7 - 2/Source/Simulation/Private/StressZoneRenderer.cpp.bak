// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "StressZoneRenderer.h"
#include "RiskDataManager.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "ProceduralMeshComponent.h"

DEFINE_LOG_CATEGORY(LogStressZone);

AStressZoneRenderer::AStressZoneRenderer()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = 0.033f; // ~30 Hz

    // Load impact timeline keyframes
    ImpactTimeline = ARiskDataManager::GetImpactTimeline();
}

void AStressZoneRenderer::BeginPlay()
{
    Super::BeginPlay();
    UE_LOG(LogStressZone, Log, TEXT("StressZoneRenderer ready. %d timeline keyframes loaded."),
        ImpactTimeline.Num());
}

void AStressZoneRenderer::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    if (bTimelinePlaying && RenderedZones.Num() > 0)
    {
        // Advance timeline
        const float DeltaFraction = (DeltaTime * TimelineSpeed) / TimelineDurationSeconds;
        TimelinePosition = FMath::Clamp(TimelinePosition + DeltaFraction, 0.0f, 1.0f);

        // Interpolate loss share
        CurrentLossShare = InterpolateLossShare(TimelinePosition);

        // Update zone visuals
        UpdateZonesForTimeline();

        // Auto-stop at end
        if (TimelinePosition >= 1.0f)
        {
            bTimelinePlaying = false;
        }
    }
}

// ============================================================================
// Data handlers
// ============================================================================

void AStressZoneRenderer::OnStressZonesReceived(const TArray<FStressZone>& Zones)
{
    ClearZones();

    for (const FStressZone& Zone : Zones)
    {
        if (Zone.Polygon.Num() < 3) continue; // Need at least 3 points
        CreateZoneMesh(Zone);
    }

    UE_LOG(LogStressZone, Log, TEXT("Rendered %d stress zones"), RenderedZones.Num());
}

void AStressZoneRenderer::OnActiveIncidentsReceived(const TArray<FActiveIncident>& Incidents)
{
    ClearIncidentMarkers();

    for (const FActiveIncident& Inc : Incidents)
    {
        SpawnIncidentMarker(Inc);
    }

    UE_LOG(LogStressZone, Log, TEXT("Spawned %d incident markers"), IncidentMarkers.Num());
}

// ============================================================================
// Timeline controls
// ============================================================================

void AStressZoneRenderer::SetTimelinePlaying(bool bPlaying)
{
    bTimelinePlaying = bPlaying;
    UE_LOG(LogStressZone, Log, TEXT("Timeline %s at %.1f%%"),
        bPlaying ? TEXT("PLAY") : TEXT("PAUSE"), TimelinePosition * 100.0f);
}

void AStressZoneRenderer::SetTimelineSpeed(float Speed)
{
    TimelineSpeed = FMath::Clamp(Speed, 0.1f, 100.0f);
}

void AStressZoneRenderer::ScrubTimeline(float Position)
{
    TimelinePosition = FMath::Clamp(Position, 0.0f, 1.0f);
    CurrentLossShare = InterpolateLossShare(TimelinePosition);
    UpdateZonesForTimeline();
}

void AStressZoneRenderer::ResetTimeline()
{
    TimelinePosition = 0.0f;
    CurrentLossShare = 0.17f; // T+0h initial loss
    bTimelinePlaying = false;
    UpdateZonesForTimeline();
}

// ============================================================================
// Zone mesh creation
// ============================================================================

void AStressZoneRenderer::CreateZoneMesh(const FStressZone& Zone)
{
    // Create a procedural mesh component for this zone
    UProceduralMeshComponent* MeshComp = NewObject<UProceduralMeshComponent>(this);
    MeshComp->SetupAttachment(GetRootComponent());
    MeshComp->RegisterComponent();

    // Convert geo coordinates to UE5 world space (fallback planar; add CesiumGeoreference when plugin is enabled)
    AActor* GeoRef = nullptr;

    // Build polygon vertices in local space
    TArray<FVector> Vertices;
    TArray<int32> Triangles;
    TArray<FVector> Normals;
    TArray<FVector2D> UVs;
    TArray<FLinearColor> VertexColors;

    const FLinearColor ZoneColor = GetColorForSeverity(Zone.Severity);
    const float ExtrusionHeight = Zone.RiskScore * MaxExtrusionHeightM * 100.0f; // m to cm

    // Bottom face vertices
    for (int32 i = 0; i < Zone.Polygon.Num(); i++)
    {
        // Planar projection (cm). Use CesiumGeoreference when plugin is enabled for accurate geo.
        FVector WorldPos(
            Zone.Polygon[i].Longitude * 111320.0 * 100.0,
            Zone.Polygon[i].Latitude * 110540.0 * 100.0,
            0.0
        );

        // Bottom vertex
        Vertices.Add(WorldPos);
        Normals.Add(FVector::UpVector);
        UVs.Add(FVector2D((float)i / Zone.Polygon.Num(), 0.0f));
        VertexColors.Add(ZoneColor);

        // Top vertex (extruded)
        Vertices.Add(WorldPos + FVector(0, 0, ExtrusionHeight));
        Normals.Add(FVector::UpVector);
        UVs.Add(FVector2D((float)i / Zone.Polygon.Num(), 1.0f));
        VertexColors.Add(ZoneColor);
    }

    // Triangulate top face (fan triangulation)
    const int32 VertCount = Zone.Polygon.Num();
    for (int32 i = 1; i < VertCount - 1; i++)
    {
        // Top face triangles (extruded)
        Triangles.Add(1);               // First top vertex
        Triangles.Add(i * 2 + 1);       // Current top vertex
        Triangles.Add((i + 1) * 2 + 1); // Next top vertex
    }

    // Side faces
    for (int32 i = 0; i < VertCount; i++)
    {
        const int32 Next = (i + 1) % VertCount;
        const int32 BottomCur = i * 2;
        const int32 TopCur = i * 2 + 1;
        const int32 BottomNext = Next * 2;
        const int32 TopNext = Next * 2 + 1;

        // Two triangles per side quad
        Triangles.Add(BottomCur);
        Triangles.Add(TopCur);
        Triangles.Add(TopNext);

        Triangles.Add(BottomCur);
        Triangles.Add(TopNext);
        Triangles.Add(BottomNext);
    }

    MeshComp->CreateMeshSection_LinearColor(0, Vertices, Triangles, Normals, UVs, VertexColors, TArray<FProcMeshTangent>(), true);

    // Apply material
    UMaterialInstanceDynamic* MatInst = nullptr;
    if (ZoneBaseMaterial)
    {
        MatInst = UMaterialInstanceDynamic::Create(ZoneBaseMaterial, this);
        MatInst->SetVectorParameterValue(FName(TEXT("BaseColor")), ZoneColor);
        MatInst->SetScalarParameterValue(FName(TEXT("Opacity")), ZoneColor.A);
        MeshComp->SetMaterial(0, MatInst);
    }

    MeshComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    // Store reference
    FRenderedZone RZ;
    RZ.ZoneId = Zone.ZoneId;
    RZ.MeshComponent = MeshComp;
    RZ.Material = MatInst;
    RZ.Data = Zone;
    RenderedZones.Add(RZ);
}

void AStressZoneRenderer::ClearZones()
{
    for (FRenderedZone& RZ : RenderedZones)
    {
        if (RZ.MeshComponent)
        {
            RZ.MeshComponent->DestroyComponent();
        }
    }
    RenderedZones.Empty();
}

// ============================================================================
// Timeline interpolation
// ============================================================================

float AStressZoneRenderer::InterpolateLossShare(float Position) const
{
    if (ImpactTimeline.Num() == 0) return 0.0f;
    if (Position <= 0.0f) return ImpactTimeline[0].LossShare;
    if (Position >= 1.0f) return ImpactTimeline.Last().LossShare;

    // Find surrounding keyframes
    for (int32 i = 0; i < ImpactTimeline.Num() - 1; i++)
    {
        const float T0 = ImpactTimeline[i].TimeFraction;
        const float T1 = ImpactTimeline[i + 1].TimeFraction;
        if (Position >= T0 && Position <= T1)
        {
            const float Alpha = (T1 - T0 > 0.0001f)
                ? (Position - T0) / (T1 - T0)
                : 0.0f;
            return FMath::Lerp(ImpactTimeline[i].LossShare, ImpactTimeline[i + 1].LossShare, Alpha);
        }
    }

    return ImpactTimeline.Last().LossShare;
}

void AStressZoneRenderer::UpdateZonesForTimeline()
{
    for (FRenderedZone& RZ : RenderedZones)
    {
        if (!RZ.Material) continue;

        // Scale opacity and height by current loss share
        const FLinearColor BaseColor = GetColorForSeverity(RZ.Data.Severity);
        const float Opacity = BaseColor.A * CurrentLossShare;
        const float HeightScale = CurrentLossShare;

        RZ.Material->SetScalarParameterValue(FName(TEXT("Opacity")), Opacity);
        RZ.Material->SetScalarParameterValue(FName(TEXT("HeightScale")), HeightScale);

        // Update mesh scale Z to reflect timeline progression
        if (RZ.MeshComponent)
        {
            FVector Scale = RZ.MeshComponent->GetComponentScale();
            Scale.Z = FMath::Max(0.01f, HeightScale);
            RZ.MeshComponent->SetWorldScale3D(Scale);
        }
    }
}

// ============================================================================
// Incident markers
// ============================================================================

void AStressZoneRenderer::SpawnIncidentMarker(const FActiveIncident& Incident)
{
    // Planar projection (cm). Use CesiumGeoreference when plugin enabled.
    FVector WorldPos(
        Incident.Location.Longitude * 111320.0 * 100.0,
        Incident.Location.Latitude * 110540.0 * 100.0,
        10000.0 // 100m above ground
    );

    // For now, log the incident. In production, spawn appropriate Niagara VFX:
    // Earthquake: orange pulsing sphere, radius scaled by magnitude
    // Fire: Niagara fire particle system
    // Weather alert: semi-transparent colored volume
    switch (Incident.Type)
    {
        case ERiskIncidentType::Earthquake:
            UE_LOG(LogStressZone, Log, TEXT("Incident: Earthquake M%.1f at (%.2f, %.2f) - %s"),
                Incident.Magnitude, Incident.Location.Latitude, Incident.Location.Longitude, *Incident.Title);
            break;
        case ERiskIncidentType::Fire:
            UE_LOG(LogStressZone, Log, TEXT("Incident: Fire at (%.2f, %.2f) - %s"),
                Incident.Location.Latitude, Incident.Location.Longitude, *Incident.Title);
            break;
        case ERiskIncidentType::WeatherAlert:
            UE_LOG(LogStressZone, Log, TEXT("Incident: Weather Alert at (%.2f, %.2f) - %s [%s]"),
                Incident.Location.Latitude, Incident.Location.Longitude, *Incident.Title, *Incident.Severity);
            break;
        default:
            break;
    }

    // Placeholder: In full implementation, spawn actor with Niagara VFX component
    // at WorldPos and add to IncidentMarkers array
}

void AStressZoneRenderer::ClearIncidentMarkers()
{
    for (AActor* Marker : IncidentMarkers)
    {
        if (Marker && Marker->IsValidLowLevel())
        {
            Marker->Destroy();
        }
    }
    IncidentMarkers.Empty();
}

// ============================================================================
// Visual helpers
// ============================================================================

FLinearColor AStressZoneRenderer::GetColorForSeverity(const FString& Severity) const
{
    if (Severity == TEXT("critical")) return ColorCritical;
    if (Severity == TEXT("high"))     return ColorHigh;
    if (Severity == TEXT("medium"))   return ColorMedium;
    if (Severity == TEXT("low"))      return ColorLow;
    return ColorMedium; // default
}
