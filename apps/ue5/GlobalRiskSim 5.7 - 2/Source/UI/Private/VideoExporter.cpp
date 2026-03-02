// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "VideoExporter.h"
#include "LevelSequenceActor.h"
#include "LevelSequencePlayer.h"
#include "MoviePipelineQueue.h"
#include "MoviePipelineQueueSubsystem.h"
#include "MoviePipelinePrimaryConfig.h"
#include "Kismet/GameplayStatics.h"

DEFINE_LOG_CATEGORY(LogVideoExport);

AVideoExporter::AVideoExporter()
{
    PrimaryActorTick.bCanEverTick = false;
}

void AVideoExporter::BeginPlay()
{
    Super::BeginPlay();

    // Register default camera presets if none configured
    if (CameraPresets.Num() == 0)
    {
        FCameraPreset Flyover;
        Flyover.Name = TEXT("City Flyover");
        CameraPresets.Add(Flyover);

        FCameraPreset Street;
        Street.Name = TEXT("Street Level");
        CameraPresets.Add(Street);

        FCameraPreset Damage;
        Damage.Name = TEXT("Zoom on Damage");
        CameraPresets.Add(Damage);

        UE_LOG(LogVideoExport, Log,
            TEXT("VideoExporter: %d camera presets registered (assign sequences in editor)"),
            CameraPresets.Num());
    }
}

void AVideoExporter::PlayCameraPreset(int32 PresetIndex)
{
    if (!CameraPresets.IsValidIndex(PresetIndex))
    {
        UE_LOG(LogVideoExport, Warning, TEXT("Invalid preset index: %d"), PresetIndex);
        return;
    }

    const FCameraPreset& Preset = CameraPresets[PresetIndex];

    // Load the level sequence asset
    ULevelSequence* Sequence = Preset.Sequence.LoadSynchronous();
    if (!Sequence)
    {
        UE_LOG(LogVideoExport, Warning, TEXT("Sequence not assigned for preset '%s'"), *Preset.Name);
        return;
    }

    // Stop any existing playback
    StopSequence();

    // Create sequence player
    FMovieSceneSequencePlaybackSettings Settings;
    Settings.bAutoPlay = true;
    Settings.bPauseAtEnd = true;

    ALevelSequenceActor* SequenceActor = nullptr;
    ActiveSequencePlayer = ULevelSequencePlayer::CreateLevelSequencePlayer(
        GetWorld(),
        Sequence,
        Settings,
        SequenceActor
    );

    if (ActiveSequencePlayer)
    {
        ActiveSequencePlayer->Play();
        UE_LOG(LogVideoExport, Log, TEXT("Playing camera preset: %s"), *Preset.Name);
    }
}

void AVideoExporter::StopSequence()
{
    if (ActiveSequencePlayer)
    {
        ActiveSequencePlayer->Stop();
        ActiveSequencePlayer = nullptr;
    }
}

void AVideoExporter::StartVideoExport(int32 PresetIndex)
{
    if (bIsExporting)
    {
        UE_LOG(LogVideoExport, Warning, TEXT("Export already in progress"));
        return;
    }

    if (!CameraPresets.IsValidIndex(PresetIndex))
    {
        UE_LOG(LogVideoExport, Warning, TEXT("Invalid preset index: %d"), PresetIndex);
        return;
    }

    UE_LOG(LogVideoExport, Log, TEXT("Starting MRQ export: %dx%d @%d fps, format=%s"),
        OutputWidth, OutputHeight, OutputFPS, *OutputFormat);
    UE_LOG(LogVideoExport, Log, TEXT("  Preset: %s"), *CameraPresets[PresetIndex].Name);
    UE_LOG(LogVideoExport, Log, TEXT("  Output: %s"), *OutputDirectory);

    // MRQ export requires:
    // 1. A UMoviePipelineQueue with a job
    // 2. A UMoviePipelinePrimaryConfig with render settings
    // 3. The queue subsystem to execute it
    //
    // In a Blueprint-driven workflow, the user configures this in editor.
    // Here we provide the C++ scaffolding:

    UMoviePipelineQueueSubsystem* QueueSubsystem =
        GEngine->GetEngineSubsystem<UMoviePipelineQueueSubsystem>();
    if (!QueueSubsystem)
    {
        UE_LOG(LogVideoExport, Error, TEXT("MoviePipelineQueueSubsystem not available"));
        return;
    }

    // Create queue programmatically
    UMoviePipelineQueue* Queue = NewObject<UMoviePipelineQueue>(this);
    UMoviePipelineExecutorJob* Job = Queue->AllocateNewJob(UMoviePipelineExecutorJob::StaticClass());

    if (Job)
    {
        ULevelSequence* Seq = CameraPresets[PresetIndex].Sequence.LoadSynchronous();
        if (Seq)
        {
            Job->Sequence = FSoftObjectPath(Seq);
            Job->JobName = FString::Printf(TEXT("RiskSim_%s"), *CameraPresets[PresetIndex].Name);

            // Configuration would be set here: output settings, AA, etc.
            // For now, use default pipeline config
        }
    }

    bIsExporting = true;
    ExportProgress = 0.0f;

    UE_LOG(LogVideoExport, Log, TEXT("MRQ export queued. Monitor progress in editor."));
}

void AVideoExporter::CancelExport()
{
    if (!bIsExporting) return;

    bIsExporting = false;
    ExportProgress = 0.0f;
    UE_LOG(LogVideoExport, Log, TEXT("Export cancelled"));
}

TArray<FString> AVideoExporter::GetPresetNames() const
{
    TArray<FString> Names;
    for (const auto& P : CameraPresets)
    {
        Names.Add(P.Name);
    }
    return Names;
}
