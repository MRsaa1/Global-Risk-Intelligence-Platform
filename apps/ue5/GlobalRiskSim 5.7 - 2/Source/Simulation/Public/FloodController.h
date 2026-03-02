// Copyright (c) 2026 SAA Platform. All rights reserved.
// FloodController: Drives FluidFlux simulation from API flood data.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RiskDataTypes.h"
#include "FloodController.generated.h"

DECLARE_LOG_CATEGORY_EXTERN(LogFloodSim, Log, All);

/**
 * AFloodController
 *
 * Placed in each city level alongside the FluidFlux simulation actor.
 * Listens to ARiskDataManager::OnFloodUpdated and drives:
 *  - Water height (FluidFlux WaterHeight parameter)
 *  - Inflow sources at polygon boundary points
 *  - Metro entrance water sources
 *  - Risk-level material color transitions
 */
UCLASS(Blueprintable, BlueprintType)
class SIMULATION_API AFloodController : public AActor
{
    GENERATED_BODY()

public:
    AFloodController();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;

    // ── Configuration ──────────────────────────────────────────────

    /** Reference to the FluidFlux simulation actor (set in editor or found at runtime) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Config")
    AActor* FluidFluxActor = nullptr;

    /** Grid dimensions for FluidFlux (cells) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Config")
    int32 GridWidth = 2048;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Config")
    int32 GridHeight = 2048;

    /** Cell size in centimeters */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Config")
    float CellSizeCm = 100.0f;

    /** Current target flood depth (meters) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Runtime")
    float TargetFloodDepthM = 0.0f;

    /** Current actual flood depth (interpolates toward target) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Flood|Runtime")
    float CurrentFloodDepthM = 0.0f;

    /** Depth interpolation speed (meters per second) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Config")
    float DepthLerpSpeed = 0.5f;

    /** Preset depth steps (meters) matching the web UI slider */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Config")
    TArray<float> DepthPresets;

    /** Current risk level string (normal, elevated, high, critical) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Flood|Runtime")
    FString CurrentRiskLevel;

    // ── Risk-level colors (for water material) ─────────────────────

    /** Water color at 0-1m depth (normal) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Visual")
    FLinearColor ColorNormal = FLinearColor(0.0f, 0.5f, 0.7f, 0.6f);

    /** Water color at 1-3m depth (elevated) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Visual")
    FLinearColor ColorElevated = FLinearColor(1.0f, 0.75f, 0.0f, 0.7f);

    /** Water color at 3-6m depth (high) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Visual")
    FLinearColor ColorHigh = FLinearColor(1.0f, 0.5f, 0.0f, 0.8f);

    /** Water color at 6m+ depth (critical) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Visual")
    FLinearColor ColorCritical = FLinearColor(0.9f, 0.1f, 0.1f, 0.9f);

    /** Material instance to apply color changes to */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flood|Visual")
    UMaterialInstanceDynamic* WaterMaterial = nullptr;

    // ── Metro flooding ─────────────────────────────────────────────

    /** Metro entrance flood sources (spawned dynamically) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Flood|Metro")
    TArray<AActor*> MetroFloodSources;

    // ── Blueprint-callable ─────────────────────────────────────────

    /** Set flood depth directly (overrides API data) */
    UFUNCTION(BlueprintCallable, Category = "Flood|Control")
    void SetFloodDepth(float DepthMeters);

    /** Set flood depth by preset index (0-5 for 0.5, 1, 2, 3, 6, 9 m) */
    UFUNCTION(BlueprintCallable, Category = "Flood|Control")
    void SetFloodPreset(int32 PresetIndex);

    /** Receive new flood data from API */
    UFUNCTION(BlueprintCallable, Category = "Flood|Control")
    void OnFloodDataReceived(const FFloodData& Data);

    /** Receive metro flood data from API */
    UFUNCTION(BlueprintCallable, Category = "Flood|Control")
    void OnMetroFloodReceived(const TArray<FMetroFloodPoint>& Points);

    /** Get the water color for a given depth */
    UFUNCTION(BlueprintPure, Category = "Flood|Visual")
    FLinearColor GetWaterColorForDepth(float DepthM) const;

    /** Get risk level string for a depth */
    UFUNCTION(BlueprintPure, Category = "Flood|Visual")
    static FString GetRiskLevelForDepth(float DepthM);

private:
    void UpdateWaterMaterial();
    void SpawnMetroFloodSources(const TArray<FMetroFloodPoint>& Points);
    void ClearMetroFloodSources();
    void SetFluidFluxWaterHeight(float HeightCm);
};
