// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "RiskHUD.h"
#include "Blueprint/UserWidget.h"
#include "RiskDataManager.h"
#include "Kismet/GameplayStatics.h"

DEFINE_LOG_CATEGORY(LogRiskHUD);

ARiskHUD::ARiskHUD()
{
}

void ARiskHUD::BeginPlay()
{
    Super::BeginPlay();

    // Create main HUD widget
    if (MainHUDWidgetClass)
    {
        MainHUDWidget = CreateWidget<UUserWidget>(GetOwningPlayerController(), MainHUDWidgetClass);
        if (MainHUDWidget)
        {
            MainHUDWidget->AddToViewport(0);
            UE_LOG(LogRiskHUD, Log, TEXT("Main HUD widget created"));
        }
    }
    else
    {
        UE_LOG(LogRiskHUD, Warning,
            TEXT("MainHUDWidgetClass not set. Create a UMG widget Blueprint and assign it."));
    }

    // Create incidents table widget
    if (IncidentsTableWidgetClass)
    {
        IncidentsTableWidget = CreateWidget<UUserWidget>(GetOwningPlayerController(), IncidentsTableWidgetClass);
        if (IncidentsTableWidget)
        {
            IncidentsTableWidget->AddToViewport(1);
        }
    }

    UE_LOG(LogRiskHUD, Log, TEXT("RiskHUD initialized"));
}

void ARiskHUD::DrawHUD()
{
    Super::DrawHUD();

    // For debug: draw basic text overlay when no UMG widget is set
    if (!MainHUDWidget)
    {
        // Top-left: Data overlay
        const float X = 20.0f;
        float Y = 60.0f;
        const float LineH = 22.0f;
        const FLinearColor White(1, 1, 1, 1);
        const FLinearColor Yellow(1, 0.9f, 0.2f, 1);
        const FLinearColor Cyan(0.2f, 0.9f, 1, 1);

        DrawText(FString::Printf(TEXT("GLOBAL RISK SIMULATOR")),
            White, X, Y, nullptr, 1.2f);
        Y += LineH * 1.5f;

        DrawText(FString::Printf(TEXT("City: %s"), *CurrentCityName),
            Cyan, X, Y);
        Y += LineH;

        DrawText(FString::Printf(TEXT("Scenario: %s"), *CurrentScenarioName),
            Cyan, X, Y);
        Y += LineH * 1.5f;

        DrawText(FString::Printf(TEXT("Risk Score: %.2f"), RiskScore),
            RiskScore > 0.7f ? FLinearColor(1, 0.2f, 0.2f, 1) : Yellow, X, Y);
        Y += LineH;

        DrawText(FString::Printf(TEXT("Exposure: $%.1f B"), ExposureBillions),
            White, X, Y);
        Y += LineH;

        DrawText(FString::Printf(TEXT("Est. Damage: $%.0f M"), EstimatedDamageUsd / 1000000.0f),
            Yellow, X, Y);
        Y += LineH;

        DrawText(FString::Printf(TEXT("Affected Buildings: %d"), AffectedBuildingsCount),
            White, X, Y);
        Y += LineH * 1.5f;

        // Timeline
        const FString PlayState = bTimelinePlaying ? TEXT("PLAYING") : TEXT("PAUSED");
        DrawText(FString::Printf(TEXT("Timeline: %.0f%% [%s] x%.0f | Loss: %.0f%%"),
            TimelinePosition * 100.0f, *PlayState, TimelineSpeed, CurrentLossPercent * 100.0f),
            Yellow, X, Y);
        Y += LineH * 1.5f;

        // Layer toggles
        DrawText(TEXT("Layers:"), White, X, Y);
        Y += LineH;
        auto DrawToggle = [&](const FString& Name, bool bOn)
        {
            DrawText(FString::Printf(TEXT("  [%s] %s"), bOn ? TEXT("X") : TEXT(" "), *Name),
                bOn ? FLinearColor(0.2f, 1, 0.2f, 1) : FLinearColor(0.5f, 0.5f, 0.5f, 1), X, Y);
            Y += LineH;
        };
        DrawToggle(TEXT("Flood"), bShowFlood);
        DrawToggle(TEXT("Wind"), bShowWind);
        DrawToggle(TEXT("Earthquake"), bShowEarthquake);
        DrawToggle(TEXT("Fire"), bShowFire);
        DrawToggle(TEXT("Metro"), bShowMetro);
        DrawToggle(TEXT("Zones"), bShowZones);
        DrawToggle(TEXT("Incidents"), bShowIncidents);
        DrawToggle(TEXT("Buildings"), bShowBuildings);
        DrawToggle(TEXT("Infra Links"), bShowInfraLinks);

        // Active incidents (top-right)
        if (DisplayedIncidents.Num() > 0)
        {
            const float RightX = Canvas->SizeX - 500.0f;
            float RY = 60.0f;

            DrawText(TEXT("ACTIVE INCIDENTS"), FLinearColor(1, 0.3f, 0.3f, 1), RightX, RY, nullptr, 1.1f);
            RY += LineH * 1.5f;

            DrawText(TEXT("Type       | Severity | Region           | Impact"), White, RightX, RY);
            RY += LineH;

            const int32 MaxDisplay = FMath::Min(DisplayedIncidents.Num(), 15);
            for (int32 i = 0; i < MaxDisplay; i++)
            {
                const FActiveIncident& Inc = DisplayedIncidents[i];
                FString TypeStr;
                switch (Inc.Type)
                {
                    case ERiskIncidentType::Earthquake: TypeStr = TEXT("QUAKE"); break;
                    case ERiskIncidentType::Fire: TypeStr = TEXT("FIRE "); break;
                    case ERiskIncidentType::WeatherAlert: TypeStr = TEXT("ALERT"); break;
                    default: TypeStr = TEXT("OTHER"); break;
                }

                const FLinearColor IncColor = (Inc.Severity == TEXT("extreme"))
                    ? FLinearColor(1, 0.1f, 0.1f, 1)
                    : (Inc.Severity == TEXT("severe"))
                    ? FLinearColor(1, 0.5f, 0, 1)
                    : Yellow;

                DrawText(FString::Printf(TEXT("%-10s | %-8s | %-16s | %s"),
                    *TypeStr, *Inc.Severity, *Inc.AffectedRegion.Left(16), *Inc.InfrastructureImpact.Left(30)),
                    IncColor, RightX, RY);
                RY += LineH;
            }

            if (DisplayedIncidents.Num() > MaxDisplay)
            {
                DrawText(FString::Printf(TEXT("... and %d more"),
                    DisplayedIncidents.Num() - MaxDisplay), White, RightX, RY);
            }
        }
    }
}

// ============================================================================
// Actions
// ============================================================================

void ARiskHUD::SelectCity(const FString& CityId)
{
    const FCityConfig City = ARiskDataManager::GetCityPresetById(CityId);
    CurrentCityName = City.DisplayName;
    OnCitySelected.Broadcast(CityId);
    UE_LOG(LogRiskHUD, Log, TEXT("City selected: %s"), *CityId);
}

void ARiskHUD::SelectScenario(const FString& ScenarioId)
{
    CurrentScenarioName = ScenarioId;
    OnScenarioSelected.Broadcast(ScenarioId);
    UE_LOG(LogRiskHUD, Log, TEXT("Scenario selected: %s"), *ScenarioId);
}

void ARiskHUD::ToggleTimelinePlayPause()
{
    bTimelinePlaying = !bTimelinePlaying;
    OnTimelinePlayPause.Broadcast();
}

void ARiskHUD::SetTimelineSpeed(float Speed)
{
    TimelineSpeed = FMath::Clamp(Speed, 0.1f, 100.0f);
    OnTimelineSpeedChanged.Broadcast(TimelineSpeed);
}

void ARiskHUD::ScrubTimeline(float Position)
{
    TimelinePosition = FMath::Clamp(Position, 0.0f, 1.0f);
    OnTimelineScrubbed.Broadcast(TimelinePosition);
}

void ARiskHUD::ToggleLayer(const FString& LayerName)
{
    bool* Toggle = nullptr;
    if      (LayerName == TEXT("Flood"))      Toggle = &bShowFlood;
    else if (LayerName == TEXT("Wind"))       Toggle = &bShowWind;
    else if (LayerName == TEXT("Earthquake")) Toggle = &bShowEarthquake;
    else if (LayerName == TEXT("Fire"))       Toggle = &bShowFire;
    else if (LayerName == TEXT("Metro"))      Toggle = &bShowMetro;
    else if (LayerName == TEXT("Zones"))      Toggle = &bShowZones;
    else if (LayerName == TEXT("Incidents"))  Toggle = &bShowIncidents;
    else if (LayerName == TEXT("Buildings"))  Toggle = &bShowBuildings;
    else if (LayerName == TEXT("InfraLinks")) Toggle = &bShowInfraLinks;

    if (Toggle)
    {
        *Toggle = !(*Toggle);
        OnLayerToggled.Broadcast(LayerName, *Toggle);
        UE_LOG(LogRiskHUD, Log, TEXT("Layer '%s' %s"), *LayerName, *Toggle ? TEXT("ON") : TEXT("OFF"));
    }
}

void ARiskHUD::RequestVideoExport()
{
    OnVideoExportRequested.Broadcast();
    UE_LOG(LogRiskHUD, Log, TEXT("Video export requested (MRQ)"));
}

void ARiskHUD::UpdateDataOverlay(float InRiskScore, float InExposure, float InDamage, int32 InBuildings)
{
    RiskScore = InRiskScore;
    ExposureBillions = InExposure;
    EstimatedDamageUsd = InDamage;
    AffectedBuildingsCount = InBuildings;
}

void ARiskHUD::UpdateIncidentsDisplay(const TArray<FActiveIncident>& Incidents)
{
    DisplayedIncidents = Incidents;
}

TArray<FString> ARiskHUD::GetStressTestTypes()
{
    return {
        TEXT("climate"),
        TEXT("geopolitical"),
        TEXT("financial"),
        TEXT("pandemic"),
        TEXT("energy")
    };
}

TArray<FString> ARiskHUD::GetCityNames()
{
    TArray<FString> Names;
    const TArray<FCityConfig> Cities = ARiskDataManager::GetCityPresets();
    for (const auto& C : Cities)
    {
        Names.Add(C.DisplayName);
    }
    return Names;
}
