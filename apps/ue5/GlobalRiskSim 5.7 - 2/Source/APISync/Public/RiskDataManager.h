// Copyright (c) 2026 SAA Platform. All rights reserved.
// Singleton actor that manages API data lifecycle, caching, and auto-polling.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RiskAPIClient.h"
#include "RiskDataTypes.h"
#include "RiskDataManager.generated.h"

/**
 * ARiskDataManager
 *
 * Place one instance in each level. It owns a URiskAPIClient,
 * manages poll timers, and caches the latest data for other actors
 * (FloodController, WindController, StressZoneRenderer, etc.) to consume.
 */
UCLASS(Blueprintable, BlueprintType)
class APISYNC_API ARiskDataManager : public AActor
{
    GENERATED_BODY()

public:
    ARiskDataManager();

    // ── Lifecycle ──────────────────────────────────────────────────
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void Tick(float DeltaTime) override;

    // ── Configuration ──────────────────────────────────────────────

    /** API client (auto-created in BeginPlay) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskData")
    URiskAPIClient* APIClient = nullptr;

    /** City this level represents */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskData|Config")
    FCityConfig CurrentCity;

    /** Active stress test ID (empty = none) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskData|Config")
    FString ActiveStressTestId;

    /** Active high-fidelity scenario ID (empty = use standard forecasts) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskData|Config")
    FString ActiveScenarioId;

    /** Poll interval for live data (seconds) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskData|Config")
    float PollIntervalSeconds = 60.0f;

    /** Auto-fetch on BeginPlay */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskData|Config")
    bool bAutoFetchOnStart = true;

    // ── Cached data ────────────────────────────────────────────────

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskData|Cache")
    FFloodData CachedFlood;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskData|Cache")
    FWindData CachedWind;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskData|Cache")
    TArray<FStressZone> CachedStressZones;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskData|Cache")
    TArray<FActiveIncident> CachedIncidents;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskData|Cache")
    TArray<FInfrastructureItem> CachedInfrastructure;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskData|Cache")
    TArray<FMetroFloodPoint> CachedMetroFlood;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskData|Cache")
    TArray<FEarthquakeZone> CachedEarthquakeZones;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskData|Cache")
    TArray<FBuildingDamage> CachedBuildings;

    // ── Re-broadcast delegates (for actors listening to this manager) ──

    UPROPERTY(BlueprintAssignable, Category = "RiskData|Events")
    FOnFloodDataReceived OnFloodUpdated;

    UPROPERTY(BlueprintAssignable, Category = "RiskData|Events")
    FOnWindDataReceived OnWindUpdated;

    UPROPERTY(BlueprintAssignable, Category = "RiskData|Events")
    FOnStressZonesReceived OnStressZonesUpdated;

    UPROPERTY(BlueprintAssignable, Category = "RiskData|Events")
    FOnActiveIncidentsReceived OnIncidentsUpdated;

    UPROPERTY(BlueprintAssignable, Category = "RiskData|Events")
    FOnInfrastructureReceived OnInfrastructureUpdated;

    UPROPERTY(BlueprintAssignable, Category = "RiskData|Events")
    FOnMetroFloodReceived OnMetroFloodUpdated;

    UPROPERTY(BlueprintAssignable, Category = "RiskData|Events")
    FOnBuildingDamageReceived OnBuildingsUpdated;

    // ── Manual fetch commands ──────────────────────────────────────

    /** Fetch all data for the current city and scenario */
    UFUNCTION(BlueprintCallable, Category = "RiskData|Commands")
    void FetchAllData();

    /** Switch to a different city (triggers full re-fetch) */
    UFUNCTION(BlueprintCallable, Category = "RiskData|Commands")
    void SwitchCity(const FCityConfig& NewCity);

    /** Set active stress test and fetch zones */
    UFUNCTION(BlueprintCallable, Category = "RiskData|Commands")
    void SetStressTest(const FString& StressTestId);

    /** Fetch scenario bundle (single request for all data) */
    UFUNCTION(BlueprintCallable, Category = "RiskData|Commands")
    void FetchScenarioBundle();

    // ── Static city presets ────────────────────────────────────────

    UFUNCTION(BlueprintPure, Category = "RiskData|Cities")
    static TArray<FCityConfig> GetCityPresets();

    UFUNCTION(BlueprintPure, Category = "RiskData|Cities")
    static FCityConfig GetCityPresetById(const FString& CityId);

    // ── 4D Timeline keyframes ──────────────────────────────────────

    /** Standard stress-test impact timeline keyframes */
    UFUNCTION(BlueprintPure, Category = "RiskData|Timeline")
    static TArray<FTimelineKeyframe> GetImpactTimeline();

private:
    float PollTimer = 0.0f;

    // Internal callbacks
    UFUNCTION()
    void HandleFloodData(const FFloodData& Data);
    UFUNCTION()
    void HandleWindData(const FWindData& Data);
    UFUNCTION()
    void HandleStressZones(const TArray<FStressZone>& Zones);
    UFUNCTION()
    void HandleIncidents(const TArray<FActiveIncident>& Incidents);
    UFUNCTION()
    void HandleInfrastructure(const TArray<FInfrastructureItem>& Items);
    UFUNCTION()
    void HandleMetroFlood(const TArray<FMetroFloodPoint>& Points);
    UFUNCTION()
    void HandleBuildings(const TArray<FBuildingDamage>& Buildings);
    UFUNCTION()
    void HandleScenarioBundle(const FScenarioBundle& Bundle);
};
