// Copyright (c) 2026 SAA Platform. All rights reserved.
// WindController: Drives wind simulation and Chaos destruction from API wind data.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RiskDataTypes.h"
#include "WindController.generated.h"

DECLARE_LOG_CATEGORY_EXTERN(LogWindSim, Log, All);

/** Saffir-Simpson category thresholds (km/h) */
namespace SaffirSimpson
{
    constexpr float Cat0Max = 118.0f;
    constexpr float Cat1Min = 119.0f;  constexpr float Cat1Max = 153.0f;
    constexpr float Cat2Min = 154.0f;  constexpr float Cat2Max = 177.0f;
    constexpr float Cat3Min = 178.0f;  constexpr float Cat3Max = 208.0f;
    constexpr float Cat4Min = 209.0f;  constexpr float Cat4Max = 251.0f;
    constexpr float Cat5Min = 252.0f;
}

/**
 * AWindController
 *
 * Manages wind directional sources and Chaos destruction in the level.
 * Listens to ARiskDataManager::OnWindUpdated.
 *
 * Visual mapping (matching web):
 *  Cat 0-1: trees sway, rain
 *  Cat 2-3: debris, roof damage
 *  Cat 4-5: structural collapse, flying debris
 */
UCLASS(Blueprintable, BlueprintType)
class SIMULATION_API AWindController : public AActor
{
    GENERATED_BODY()

public:
    AWindController();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;

    // ── Configuration ──────────────────────────────────────────────

    /** Reference to WindDirectionalSource in the level */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wind|Config")
    AActor* WindSource = nullptr;

    /** Niagara system for rain particles */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wind|VFX")
    AActor* RainVFXActor = nullptr;

    /** Niagara system for debris particles */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wind|VFX")
    AActor* DebrisVFXActor = nullptr;

    /** Niagara system for dust/smoke */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wind|VFX")
    AActor* DustVFXActor = nullptr;

    // ── Runtime state ──────────────────────────────────────────────

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Wind|Runtime")
    float CurrentWindKmh = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Wind|Runtime")
    float TargetWindKmh = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Wind|Runtime")
    int32 CurrentCategory = 0;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Wind|Runtime")
    float CurrentDirectionDeg = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Wind|Runtime")
    float TargetDirectionDeg = 0.0f;

    /** Interpolation speed for wind changes */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wind|Config")
    float WindLerpSpeed = 2.0f;

    // ── Chaos Destruction thresholds ───────────────────────────────

    /** Wind speed (km/h) at which buildings start showing cracks */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wind|Destruction")
    float CrackThresholdKmh = 178.0f; // Cat 3

    /** Wind speed (km/h) at which structural collapse begins */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wind|Destruction")
    float CollapseThresholdKmh = 252.0f; // Cat 5

    /** Force multiplier for Chaos destruction fields */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wind|Destruction")
    float DestructionForceMultiplier = 1.0f;

    // ── Destructible buildings ─────────────────────────────────────

    /** Actors with Geometry Collection components (destructible buildings) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wind|Destruction")
    TArray<AActor*> DestructibleBuildings;

    // ── Blueprint-callable ─────────────────────────────────────────

    /** Receive new wind data from API */
    UFUNCTION(BlueprintCallable, Category = "Wind|Control")
    void OnWindDataReceived(const FWindData& Data);

    /** Set wind speed and direction manually */
    UFUNCTION(BlueprintCallable, Category = "Wind|Control")
    void SetWind(float SpeedKmh, float DirectionDeg);

    /** Set category directly (auto-calculates representative speed) */
    UFUNCTION(BlueprintCallable, Category = "Wind|Control")
    void SetCategory(int32 Cat);

    /** Get Saffir-Simpson category for a given wind speed */
    UFUNCTION(BlueprintPure, Category = "Wind|Util")
    static int32 GetCategoryForSpeed(float SpeedKmh);

    /** Convert km/h to UE5 wind speed (m/s * scale factor) */
    UFUNCTION(BlueprintPure, Category = "Wind|Util")
    static float KmhToUE5WindSpeed(float SpeedKmh);

private:
    void UpdateWindSource();
    void UpdateVFX();
    void UpdateDestruction();
    void ApplyDestructionForce(AActor* Building, float Force);

    // Track previous category for VFX transitions
    int32 PreviousCategory = -1;
};
