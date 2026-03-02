// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "FloodController.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"

DEFINE_LOG_CATEGORY(LogFloodSim);

AFloodController::AFloodController()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = 0.033f; // ~30 Hz for smooth interpolation

    // Web UI depth presets: 0.5, 1, 2, 3, 6, 9 meters
    DepthPresets = { 0.5f, 1.0f, 2.0f, 3.0f, 6.0f, 9.0f };
}

void AFloodController::BeginPlay()
{
    Super::BeginPlay();

    // Try to find FluidFlux actor if not assigned
    if (!FluidFluxActor)
    {
        TArray<AActor*> Found;
        UGameplayStatics::GetAllActorsWithTag(GetWorld(), FName(TEXT("FluidFlux")), Found);
        if (Found.Num() > 0)
        {
            FluidFluxActor = Found[0];
            UE_LOG(LogFloodSim, Log, TEXT("Auto-found FluidFlux actor: %s"), *FluidFluxActor->GetName());
        }
        else
        {
            UE_LOG(LogFloodSim, Warning, TEXT("No FluidFlux actor found. Tag one with 'FluidFlux' or assign in editor."));
        }
    }

    UE_LOG(LogFloodSim, Log, TEXT("FloodController ready. Grid %dx%d, cell %.0f cm"),
        GridWidth, GridHeight, CellSizeCm);
}

void AFloodController::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // Smoothly interpolate water depth
    if (!FMath::IsNearlyEqual(CurrentFloodDepthM, TargetFloodDepthM, 0.001f))
    {
        CurrentFloodDepthM = FMath::FInterpTo(
            CurrentFloodDepthM, TargetFloodDepthM, DeltaTime, DepthLerpSpeed);

        // Update FluidFlux water height (meters to centimeters)
        SetFluidFluxWaterHeight(CurrentFloodDepthM * 100.0f);

        // Update material color
        UpdateWaterMaterial();
    }
}

// ============================================================================
// Control methods
// ============================================================================

void AFloodController::SetFloodDepth(float DepthMeters)
{
    TargetFloodDepthM = FMath::Max(0.0f, DepthMeters);
    CurrentRiskLevel = GetRiskLevelForDepth(TargetFloodDepthM);
    UE_LOG(LogFloodSim, Log, TEXT("Flood depth set to %.1f m (%s)"), TargetFloodDepthM, *CurrentRiskLevel);
}

void AFloodController::SetFloodPreset(int32 PresetIndex)
{
    if (DepthPresets.IsValidIndex(PresetIndex))
    {
        SetFloodDepth(DepthPresets[PresetIndex]);
    }
}

void AFloodController::OnFloodDataReceived(const FFloodData& Data)
{
    SetFloodDepth(Data.MaxFloodDepthM);
    CurrentRiskLevel = Data.RiskLevel;

    UE_LOG(LogFloodSim, Log, TEXT("API Flood: %.1f m, %s, extent=%.1f km"),
        Data.MaxFloodDepthM, *Data.RiskLevel, Data.ExtentRadiusKm);

    // If polygon points are available, create inflow sources at boundary
    if (Data.PolygonPoints.Num() > 0)
    {
        UE_LOG(LogFloodSim, Log, TEXT("  %d polygon boundary points for inflow"), Data.PolygonPoints.Num());
        // FluidFlux inflow sources would be spawned here
        // at geographically-transformed polygon vertices
    }
}

void AFloodController::OnMetroFloodReceived(const TArray<FMetroFloodPoint>& Points)
{
    ClearMetroFloodSources();
    SpawnMetroFloodSources(Points);
}

// ============================================================================
// Visual helpers
// ============================================================================

FLinearColor AFloodController::GetWaterColorForDepth(float DepthM) const
{
    if (DepthM <= 0.0f) return FLinearColor(0, 0, 0, 0);
    if (DepthM <= 1.0f) return FMath::Lerp(ColorNormal, ColorElevated, DepthM);
    if (DepthM <= 3.0f) return FMath::Lerp(ColorElevated, ColorHigh, (DepthM - 1.0f) / 2.0f);
    if (DepthM <= 6.0f) return FMath::Lerp(ColorHigh, ColorCritical, (DepthM - 3.0f) / 3.0f);
    return ColorCritical;
}

FString AFloodController::GetRiskLevelForDepth(float DepthM)
{
    if (DepthM <= 0.5f) return TEXT("normal");
    if (DepthM <= 1.0f) return TEXT("elevated");
    if (DepthM <= 3.0f) return TEXT("high");
    return TEXT("critical");
}

void AFloodController::UpdateWaterMaterial()
{
    if (WaterMaterial)
    {
        const FLinearColor Color = GetWaterColorForDepth(CurrentFloodDepthM);
        WaterMaterial->SetVectorParameterValue(FName(TEXT("WaterColor")), Color);
        WaterMaterial->SetScalarParameterValue(FName(TEXT("WaterDepth")), CurrentFloodDepthM);
        WaterMaterial->SetScalarParameterValue(FName(TEXT("WaterOpacity")), Color.A);
    }
}

void AFloodController::SetFluidFluxWaterHeight(float HeightCm)
{
    if (!FluidFluxActor) return;

    // Set property via reflection (FluidFlux API)
    FProperty* HeightProp = FluidFluxActor->GetClass()->FindPropertyByName(FName(TEXT("WaterHeight")));
    if (HeightProp)
    {
        float* ValuePtr = HeightProp->ContainerPtrToValuePtr<float>(FluidFluxActor);
        if (ValuePtr)
        {
            *ValuePtr = HeightCm;
        }
    }
}

// ============================================================================
// Metro flood sources
// ============================================================================

void AFloodController::ClearMetroFloodSources()
{
    for (AActor* Source : MetroFloodSources)
    {
        if (Source && Source->IsValidLowLevel())
        {
            Source->Destroy();
        }
    }
    MetroFloodSources.Empty();
}

void AFloodController::SpawnMetroFloodSources(const TArray<FMetroFloodPoint>& Points)
{
    int32 FloodedCount = 0;
    for (const FMetroFloodPoint& Pt : Points)
    {
        if (!Pt.bIsFlooded) continue;
        FloodedCount++;

        // Spawn a water source at each flooded metro entrance
        // The actual FluidFlux source spawning depends on plugin API
        // Here we log the planned placement
        UE_LOG(LogFloodSim, Log, TEXT("Metro flood source: %s at (%.4f, %.4f) depth=%.1f m"),
            *Pt.Name, Pt.Location.Latitude, Pt.Location.Longitude, Pt.FloodDepthM);

        // In production: spawn FluidFlux water source actor at CesiumGeoreference-transformed position
        // and set its flow rate proportional to Pt.FloodDepthM
    }

    UE_LOG(LogFloodSim, Log, TEXT("Metro: %d/%d entrances flooded"), FloodedCount, Points.Num());
}
