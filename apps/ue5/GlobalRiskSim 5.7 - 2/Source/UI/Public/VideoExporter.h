// Copyright (c) 2026 SAA Platform. All rights reserved.
// VideoExporter: Sequencer + Movie Render Queue integration for 4K video export.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "LevelSequence.h"
#include "LevelSequencePlayer.h"
#include "VideoExporter.generated.h"

DECLARE_LOG_CATEGORY_EXTERN(LogVideoExport, Log, All);

/** Camera path preset for each city */
USTRUCT(BlueprintType)
struct FCameraPreset
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Name; // "Flyover", "Street Level", "Zoom on Damage"

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TSoftObjectPtr<ULevelSequence> Sequence;
};

/**
 * AVideoExporter
 *
 * Manages Sequencer-based camera paths and Movie Render Queue (MRQ)
 * export for creating 4K MP4 presentations of risk simulations.
 */
UCLASS(Blueprintable, BlueprintType)
class RISKUI_API AVideoExporter : public AActor
{
    GENERATED_BODY()

public:
    AVideoExporter();

    virtual void BeginPlay() override;

    // ── Configuration ──────────────────────────────────────────────

    /** Available camera presets per city */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VideoExport|Config")
    TArray<FCameraPreset> CameraPresets;

    /** Output directory for rendered videos */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VideoExport|Config")
    FString OutputDirectory = TEXT("{project}/Saved/MovieRenders/");

    /** Output resolution */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VideoExport|Config")
    int32 OutputWidth = 3840;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VideoExport|Config")
    int32 OutputHeight = 2160;

    /** Frame rate */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VideoExport|Config")
    int32 OutputFPS = 30;

    /** Output format (mp4 / avi / png_sequence) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VideoExport|Config")
    FString OutputFormat = TEXT("mp4");

    // ── Runtime state ──────────────────────────────────────────────

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VideoExport|Runtime")
    bool bIsExporting = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VideoExport|Runtime")
    float ExportProgress = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "VideoExport|Runtime")
    ULevelSequencePlayer* ActiveSequencePlayer = nullptr;

    // ── Blueprint-callable ─────────────────────────────────────────

    /** Play a camera preset sequence */
    UFUNCTION(BlueprintCallable, Category = "VideoExport|Control")
    void PlayCameraPreset(int32 PresetIndex);

    /** Stop the current sequence */
    UFUNCTION(BlueprintCallable, Category = "VideoExport|Control")
    void StopSequence();

    /** Start MRQ video export with current sequence and settings */
    UFUNCTION(BlueprintCallable, Category = "VideoExport|Control")
    void StartVideoExport(int32 PresetIndex);

    /** Cancel ongoing export */
    UFUNCTION(BlueprintCallable, Category = "VideoExport|Control")
    void CancelExport();

    /** Get list of available camera preset names */
    UFUNCTION(BlueprintPure, Category = "VideoExport|Info")
    TArray<FString> GetPresetNames() const;
};
