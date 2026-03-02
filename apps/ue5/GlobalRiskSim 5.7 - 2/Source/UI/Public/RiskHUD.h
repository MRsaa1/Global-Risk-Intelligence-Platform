// Copyright (c) 2026 SAA Platform. All rights reserved.
// RiskHUD: UMG-based HUD for scenario selection, data overlays, timeline,
// layer toggles, and active incidents table.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "Blueprint/UserWidget.h"
#include "RiskDataTypes.h"
#include "RiskHUD.generated.h"

DECLARE_LOG_CATEGORY_EXTERN(LogRiskHUD, Log, All);

// ============================================================================
// Delegates for HUD actions
// ============================================================================

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCitySelected, const FString&, CityId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnScenarioSelected, const FString&, ScenarioId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnStressTestSelected, const FString&, StressTestId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTimelineSpeedChanged, float, Speed);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTimelineScrubbed, float, Position);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnTimelinePlayPause);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnVideoExportRequested);

// Layer toggle delegate
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnLayerToggled, const FString&, LayerName, bool, bEnabled);

/**
 * ARiskHUD
 *
 * The in-engine HUD providing:
 *  - City Selector dropdown
 *  - Scenario Panel (stress test type + event selection)
 *  - Data Overlay (risk score, exposure, damage, affected buildings)
 *  - Timeline Bar (Play/Pause, speed x1/x10/x100, scrubber)
 *  - Layer Toggles (Flood, Wind, Earthquake, Fire, Metro, Zones)
 *  - Active Incidents Table
 *  - Video Export button (triggers MRQ)
 */
UCLASS(Blueprintable, BlueprintType)
class RISKUI_API ARiskHUD : public AHUD
{
    GENERATED_BODY()

public:
    ARiskHUD();

    virtual void BeginPlay() override;
    virtual void DrawHUD() override;

    // ── Widget classes (set in Blueprint subclass) ──────────────────

    /** Main HUD widget class (UMG) */
    UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "RiskHUD|Widgets")
    TSubclassOf<UUserWidget> MainHUDWidgetClass;

    /** Active Incidents table widget class */
    UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "RiskHUD|Widgets")
    TSubclassOf<UUserWidget> IncidentsTableWidgetClass;

    // ── Runtime references ─────────────────────────────────────────

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskHUD|Runtime")
    UUserWidget* MainHUDWidget = nullptr;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskHUD|Runtime")
    UUserWidget* IncidentsTableWidget = nullptr;

    // ── Data overlay values ────────────────────────────────────────

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Data")
    float RiskScore = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Data")
    float ExposureBillions = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Data")
    float EstimatedDamageUsd = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Data")
    int32 AffectedBuildingsCount = 0;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Data")
    FString CurrentCityName;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Data")
    FString CurrentScenarioName;

    // ── Timeline state (mirrored from StressZoneRenderer) ──────────

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Timeline")
    float TimelinePosition = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Timeline")
    bool bTimelinePlaying = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Timeline")
    float TimelineSpeed = 1.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "RiskHUD|Timeline")
    float CurrentLossPercent = 0.0f;

    // ── Layer visibility ───────────────────────────────────────────

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskHUD|Layers")
    bool bShowFlood = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskHUD|Layers")
    bool bShowWind = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskHUD|Layers")
    bool bShowEarthquake = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskHUD|Layers")
    bool bShowFire = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskHUD|Layers")
    bool bShowMetro = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskHUD|Layers")
    bool bShowZones = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskHUD|Layers")
    bool bShowIncidents = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskHUD|Layers")
    bool bShowBuildings = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "RiskHUD|Layers")
    bool bShowInfraLinks = true;

    // ── Active incidents cache ─────────────────────────────────────

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "RiskHUD|Data")
    TArray<FActiveIncident> DisplayedIncidents;

    // ── Delegates ──────────────────────────────────────────────────

    UPROPERTY(BlueprintAssignable, Category = "RiskHUD|Events")
    FOnCitySelected OnCitySelected;

    UPROPERTY(BlueprintAssignable, Category = "RiskHUD|Events")
    FOnScenarioSelected OnScenarioSelected;

    UPROPERTY(BlueprintAssignable, Category = "RiskHUD|Events")
    FOnStressTestSelected OnStressTestSelected;

    UPROPERTY(BlueprintAssignable, Category = "RiskHUD|Events")
    FOnTimelineSpeedChanged OnTimelineSpeedChanged;

    UPROPERTY(BlueprintAssignable, Category = "RiskHUD|Events")
    FOnTimelineScrubbed OnTimelineScrubbed;

    UPROPERTY(BlueprintAssignable, Category = "RiskHUD|Events")
    FOnTimelinePlayPause OnTimelinePlayPause;

    UPROPERTY(BlueprintAssignable, Category = "RiskHUD|Events")
    FOnLayerToggled OnLayerToggled;

    UPROPERTY(BlueprintAssignable, Category = "RiskHUD|Events")
    FOnVideoExportRequested OnVideoExportRequested;

    // ── Blueprint-callable ─────────────────────────────────────────

    /** Select a city (triggers level load) */
    UFUNCTION(BlueprintCallable, Category = "RiskHUD|Actions")
    void SelectCity(const FString& CityId);

    /** Select a scenario */
    UFUNCTION(BlueprintCallable, Category = "RiskHUD|Actions")
    void SelectScenario(const FString& ScenarioId);

    /** Toggle timeline play/pause */
    UFUNCTION(BlueprintCallable, Category = "RiskHUD|Actions")
    void ToggleTimelinePlayPause();

    /** Set timeline playback speed */
    UFUNCTION(BlueprintCallable, Category = "RiskHUD|Actions")
    void SetTimelineSpeed(float Speed);

    /** Scrub timeline to position */
    UFUNCTION(BlueprintCallable, Category = "RiskHUD|Actions")
    void ScrubTimeline(float Position);

    /** Toggle a layer on/off */
    UFUNCTION(BlueprintCallable, Category = "RiskHUD|Actions")
    void ToggleLayer(const FString& LayerName);

    /** Request video export via MRQ */
    UFUNCTION(BlueprintCallable, Category = "RiskHUD|Actions")
    void RequestVideoExport();

    /** Update the data overlay values */
    UFUNCTION(BlueprintCallable, Category = "RiskHUD|Data")
    void UpdateDataOverlay(float InRiskScore, float InExposure, float InDamage, int32 InBuildings);

    /** Update active incidents display */
    UFUNCTION(BlueprintCallable, Category = "RiskHUD|Data")
    void UpdateIncidentsDisplay(const TArray<FActiveIncident>& Incidents);

    /** Get available stress test types */
    UFUNCTION(BlueprintPure, Category = "RiskHUD|Data")
    static TArray<FString> GetStressTestTypes();

    /** Get city names for dropdown */
    UFUNCTION(BlueprintPure, Category = "RiskHUD|Data")
    static TArray<FString> GetCityNames();
};
