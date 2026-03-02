// Copyright (c) 2026 SAA Platform. All rights reserved.
// BuildingDamageVisualizer: Per-building damage coloring, water lines,
// infrastructure dependency splines, and multi-LOD heatmap.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ProceduralMeshComponent.h"
#include "Components/SplineMeshComponent.h"
#include "RiskDataTypes.h"
#include "BuildingDamageVisualizer.generated.h"

DECLARE_LOG_CATEGORY_EXTERN(LogBuildingVis, Log, All);

/** Rendered building overlay */
USTRUCT()
struct FBuildingOverlay
{
    GENERATED_BODY()

    UPROPERTY()
    FString BuildingId;

    UPROPERTY()
    UProceduralMeshComponent* DamageOverlay = nullptr;

    UPROPERTY()
    UProceduralMeshComponent* WaterLine = nullptr;

    UPROPERTY()
    UMaterialInstanceDynamic* DamageMaterial = nullptr;
};

/** Rendered infrastructure dependency link */
USTRUCT()
struct FInfraLink
{
    GENERATED_BODY()

    UPROPERTY()
    FString FromId;

    UPROPERTY()
    FString ToId;

    UPROPERTY()
    USplineMeshComponent* SplineMesh = nullptr;

    UPROPERTY()
    UMaterialInstanceDynamic* LinkMaterial = nullptr;

    /** Status: operational, degraded, failed */
    UPROPERTY()
    FString Status;
};

/**
 * ABuildingDamageVisualizer
 *
 * Handles three LOD levels:
 *  1. Globe/country view: risk heatmap overlay
 *  2. City view: zone polygons (handled by StressZoneRenderer)
 *  3. Building view: per-building damage + infrastructure splines
 */
UCLASS(Blueprintable, BlueprintType)
class SIMULATION_API ABuildingDamageVisualizer : public AActor
{
    GENERATED_BODY()

public:
    ABuildingDamageVisualizer();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;

    // ── Configuration ──────────────────────────────────────────────

    /** Material for building damage overlay (tinted by damage ratio) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Material")
    UMaterialInterface* DamageOverlayMaterial = nullptr;

    /** Material for water line rings */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Material")
    UMaterialInterface* WaterLineMaterial = nullptr;

    /** Material for infrastructure dependency lines */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Material")
    UMaterialInterface* InfraLinkMaterial = nullptr;

    /** Material for heatmap overlay at country scale */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Material")
    UMaterialInterface* HeatmapMaterial = nullptr;

    // ── Color ramp ─────────────────────────────────────────────────

    /** No damage (green) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Colors")
    FLinearColor ColorNoDamage = FLinearColor(0.1f, 0.9f, 0.2f, 0.3f);

    /** Moderate damage (amber) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Colors")
    FLinearColor ColorModerateDamage = FLinearColor(1.0f, 0.75f, 0.0f, 0.5f);

    /** Severe damage (red) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Colors")
    FLinearColor ColorSevereDamage = FLinearColor(0.9f, 0.1f, 0.1f, 0.7f);

    /** Total destruction (dark red) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Colors")
    FLinearColor ColorDestroyed = FLinearColor(0.5f, 0.0f, 0.0f, 0.9f);

    // Infrastructure link colors
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Colors")
    FLinearColor LinkOperational = FLinearColor(0.1f, 0.9f, 0.2f, 0.8f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Colors")
    FLinearColor LinkDegraded = FLinearColor(1.0f, 0.75f, 0.0f, 0.8f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|Colors")
    FLinearColor LinkFailed = FLinearColor(0.9f, 0.1f, 0.1f, 0.9f);

    // ── LOD state ──────────────────────────────────────────────────

    /** Current camera altitude (meters, updated from pawn) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BuildingVis|LOD")
    float CameraAltitudeM = 1000.0f;

    /** Altitude above which to show heatmap (meters) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|LOD")
    float HeatmapAltitudeThreshold = 50000.0f;

    /** Altitude below which to show individual buildings */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BuildingVis|LOD")
    float BuildingDetailAltitude = 2000.0f;

    // ── Blueprint-callable ─────────────────────────────────────────

    /** Receive building damage data from API */
    UFUNCTION(BlueprintCallable, Category = "BuildingVis|Data")
    void OnBuildingDamageReceived(const TArray<FBuildingDamage>& Buildings);

    /** Receive infrastructure data from API */
    UFUNCTION(BlueprintCallable, Category = "BuildingVis|Data")
    void OnInfrastructureReceived(const TArray<FInfrastructureItem>& Items);

    /** Clear all building overlays */
    UFUNCTION(BlueprintCallable, Category = "BuildingVis|Control")
    void ClearBuildingOverlays();

    /** Clear all infrastructure links */
    UFUNCTION(BlueprintCallable, Category = "BuildingVis|Control")
    void ClearInfraLinks();

    /** Animate cascade failure sequence */
    UFUNCTION(BlueprintCallable, Category = "BuildingVis|Control")
    void AnimateCascadeFailure(const TArray<FString>& FailureSequence, float DelayBetweenSeconds);

    /** Get building color for a damage ratio (0 = green, 1 = dark red) */
    UFUNCTION(BlueprintPure, Category = "BuildingVis|Colors")
    FLinearColor GetColorForDamage(float DamageRatio) const;

private:
    UPROPERTY()
    TArray<FBuildingOverlay> BuildingOverlays;

    UPROPERTY()
    TArray<FInfraLink> InfraLinks;

    UPROPERTY()
    TArray<FInfrastructureItem> CachedInfraItems;

    void CreateBuildingOverlay(const FBuildingDamage& Building);
    void CreateWaterLine(FBuildingOverlay& Overlay, const FBuildingDamage& Building);
    void CreateInfraLink(const FInfrastructureItem& From, const FInfrastructureItem& To);
    void UpdateLODVisibility();

    FVector GeoToWorld(double Lat, double Lng, double HeightM) const;

    // Cascade animation state
    TArray<FString> CascadeSequence;
    int32 CascadeIndex = 0;
    float CascadeTimer = 0.0f;
    float CascadeDelay = 1.0f;
    bool bCascadeActive = false;
};
