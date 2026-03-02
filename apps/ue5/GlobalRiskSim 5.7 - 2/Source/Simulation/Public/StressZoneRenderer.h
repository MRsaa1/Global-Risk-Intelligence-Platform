// Copyright (c) 2026 SAA Platform. All rights reserved.
// StressZoneRenderer: Visualizes risk zones from stress tests with 4D timeline.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ProceduralMeshComponent.h"
#include "RiskDataTypes.h"
#include "StressZoneRenderer.generated.h"

DECLARE_LOG_CATEGORY_EXTERN(LogStressZone, Log, All);

/** Represents a rendered zone mesh in the world */
USTRUCT(BlueprintType)
struct FRenderedZone
{
    GENERATED_BODY()

    UPROPERTY()
    FString ZoneId;

    UPROPERTY()
    UProceduralMeshComponent* MeshComponent = nullptr;

    UPROPERTY()
    UMaterialInstanceDynamic* Material = nullptr;

    UPROPERTY()
    FStressZone Data;
};

/**
 * AStressZoneRenderer
 *
 * Dynamically creates polygon meshes at zone coordinates from stress tests.
 * Supports 4D timeline animation interpolating color/height/opacity
 * from T+0h to T+12m using the standard impact timeline.
 */
UCLASS(Blueprintable, BlueprintType)
class SIMULATION_API AStressZoneRenderer : public AActor
{
    GENERATED_BODY()

public:
    AStressZoneRenderer();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;

    // ── Configuration ──────────────────────────────────────────────

    /** Maximum polygon extrusion height (meters) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "StressZone|Config")
    float MaxExtrusionHeightM = 25.0f;

    /** Zone color: critical (red) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "StressZone|Visual")
    FLinearColor ColorCritical = FLinearColor(0.9f, 0.1f, 0.1f, 0.7f);

    /** Zone color: high (orange) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "StressZone|Visual")
    FLinearColor ColorHigh = FLinearColor(1.0f, 0.5f, 0.0f, 0.6f);

    /** Zone color: medium (amber) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "StressZone|Visual")
    FLinearColor ColorMedium = FLinearColor(1.0f, 0.75f, 0.0f, 0.5f);

    /** Zone color: low (green) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "StressZone|Visual")
    FLinearColor ColorLow = FLinearColor(0.1f, 0.8f, 0.2f, 0.4f);

    /** Base material for zone meshes (translucent, emissive) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "StressZone|Visual")
    UMaterialInterface* ZoneBaseMaterial = nullptr;

    // ── 4D Timeline state ──────────────────────────────────────────

    /** Is the timeline playing? */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "StressZone|Timeline")
    bool bTimelinePlaying = false;

    /** Timeline playback speed multiplier (x1, x10, x100) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "StressZone|Timeline")
    float TimelineSpeed = 1.0f;

    /** Current timeline position (0.0 = T+0h, 1.0 = T+12m) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "StressZone|Timeline")
    float TimelinePosition = 0.0f;

    /** Current cumulative loss share at timeline position */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "StressZone|Timeline")
    float CurrentLossShare = 0.0f;

    /** Duration of full timeline in real seconds (at x1 speed) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "StressZone|Timeline")
    float TimelineDurationSeconds = 120.0f; // 2 minutes = 12 simulated months

    // ── Active incidents overlay ───────────────────────────────────

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "StressZone|Incidents")
    TArray<AActor*> IncidentMarkers;

    // ── Blueprint-callable ─────────────────────────────────────────

    /** Receive stress zones from API */
    UFUNCTION(BlueprintCallable, Category = "StressZone|Data")
    void OnStressZonesReceived(const TArray<FStressZone>& Zones);

    /** Receive active incidents from API */
    UFUNCTION(BlueprintCallable, Category = "StressZone|Data")
    void OnActiveIncidentsReceived(const TArray<FActiveIncident>& Incidents);

    /** Play/pause the 4D timeline */
    UFUNCTION(BlueprintCallable, Category = "StressZone|Timeline")
    void SetTimelinePlaying(bool bPlaying);

    /** Set timeline speed (1, 10, or 100) */
    UFUNCTION(BlueprintCallable, Category = "StressZone|Timeline")
    void SetTimelineSpeed(float Speed);

    /** Scrub to a specific position (0.0 to 1.0) */
    UFUNCTION(BlueprintCallable, Category = "StressZone|Timeline")
    void ScrubTimeline(float Position);

    /** Reset timeline to T+0 */
    UFUNCTION(BlueprintCallable, Category = "StressZone|Timeline")
    void ResetTimeline();

    /** Clear all rendered zones */
    UFUNCTION(BlueprintCallable, Category = "StressZone|Data")
    void ClearZones();

    /** Clear all incident markers */
    UFUNCTION(BlueprintCallable, Category = "StressZone|Data")
    void ClearIncidentMarkers();

    /** Get zone color by severity string */
    UFUNCTION(BlueprintPure, Category = "StressZone|Visual")
    FLinearColor GetColorForSeverity(const FString& Severity) const;

private:
    UPROPERTY()
    TArray<FRenderedZone> RenderedZones;

    TArray<FTimelineKeyframe> ImpactTimeline;

    void CreateZoneMesh(const FStressZone& Zone);
    void UpdateZonesForTimeline();
    float InterpolateLossShare(float Position) const;
    void SpawnIncidentMarker(const FActiveIncident& Incident);
};
