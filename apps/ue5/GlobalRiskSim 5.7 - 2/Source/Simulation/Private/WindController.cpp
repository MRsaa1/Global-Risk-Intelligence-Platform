// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "WindController.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Components/WindDirectionalSourceComponent.h"
#include "NiagaraComponent.h"
#include "NiagaraFunctionLibrary.h"
#include "Field/FieldSystemComponent.h"

DEFINE_LOG_CATEGORY(LogWindSim);

AWindController::AWindController()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = 0.033f; // ~30 Hz
}

void AWindController::BeginPlay()
{
    Super::BeginPlay();

    // Auto-find wind source if not assigned
    if (!WindSource)
    {
        TArray<AActor*> Found;
        UGameplayStatics::GetAllActorsWithTag(GetWorld(), FName(TEXT("WindSource")), Found);
        if (Found.Num() > 0)
        {
            WindSource = Found[0];
            UE_LOG(LogWindSim, Log, TEXT("Auto-found WindSource: %s"), *WindSource->GetName());
        }
    }

    // Auto-find destructible buildings
    if (DestructibleBuildings.Num() == 0)
    {
        UGameplayStatics::GetAllActorsWithTag(GetWorld(), FName(TEXT("Destructible")), DestructibleBuildings);
        UE_LOG(LogWindSim, Log, TEXT("Found %d destructible buildings"), DestructibleBuildings.Num());
    }

    UE_LOG(LogWindSim, Log, TEXT("WindController ready"));
}

void AWindController::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // Interpolate wind speed
    if (!FMath::IsNearlyEqual(CurrentWindKmh, TargetWindKmh, 0.1f))
    {
        CurrentWindKmh = FMath::FInterpTo(CurrentWindKmh, TargetWindKmh, DeltaTime, WindLerpSpeed);
    }

    // Interpolate direction
    if (!FMath::IsNearlyEqual(CurrentDirectionDeg, TargetDirectionDeg, 0.1f))
    {
        CurrentDirectionDeg = FMath::FInterpTo(CurrentDirectionDeg, TargetDirectionDeg, DeltaTime, WindLerpSpeed);
    }

    // Update category
    const int32 NewCat = GetCategoryForSpeed(CurrentWindKmh);
    if (NewCat != CurrentCategory)
    {
        PreviousCategory = CurrentCategory;
        CurrentCategory = NewCat;
        UE_LOG(LogWindSim, Log, TEXT("Wind category changed: Cat %d -> Cat %d (%.0f km/h)"),
            PreviousCategory, CurrentCategory, CurrentWindKmh);
    }

    UpdateWindSource();
    UpdateVFX();
    UpdateDestruction();
}

// ============================================================================
// Control methods
// ============================================================================

void AWindController::OnWindDataReceived(const FWindData& Data)
{
    TargetWindKmh = Data.MaxWindKmh;
    TargetDirectionDeg = Data.DirectionDegrees;

    UE_LOG(LogWindSim, Log, TEXT("API Wind: %.0f km/h, Cat %d, Dir %.0f deg, Turb %.2f"),
        Data.MaxWindKmh, Data.Category, Data.DirectionDegrees, Data.TurbulenceIntensity);
}

void AWindController::SetWind(float SpeedKmh, float DirectionDeg)
{
    TargetWindKmh = FMath::Max(0.0f, SpeedKmh);
    TargetDirectionDeg = FMath::Fmod(DirectionDeg, 360.0f);
}

void AWindController::SetCategory(int32 Cat)
{
    // Set representative speed for each category
    switch (Cat)
    {
        case 0: TargetWindKmh = 80.0f; break;
        case 1: TargetWindKmh = 136.0f; break;
        case 2: TargetWindKmh = 166.0f; break;
        case 3: TargetWindKmh = 193.0f; break;
        case 4: TargetWindKmh = 230.0f; break;
        case 5: TargetWindKmh = 280.0f; break;
        default: TargetWindKmh = 0.0f; break;
    }
}

int32 AWindController::GetCategoryForSpeed(float SpeedKmh)
{
    if (SpeedKmh >= SaffirSimpson::Cat5Min) return 5;
    if (SpeedKmh >= SaffirSimpson::Cat4Min) return 4;
    if (SpeedKmh >= SaffirSimpson::Cat3Min) return 3;
    if (SpeedKmh >= SaffirSimpson::Cat2Min) return 2;
    if (SpeedKmh >= SaffirSimpson::Cat1Min) return 1;
    return 0;
}

float AWindController::KmhToUE5WindSpeed(float SpeedKmh)
{
    // Convert km/h to m/s, then apply UE5 scale factor
    // UE5 wind units are roughly cm/s, so: km/h * 0.2778 * 100 = km/h * 27.78
    return SpeedKmh * 27.78f;
}

// ============================================================================
// Internal updates
// ============================================================================

void AWindController::UpdateWindSource()
{
    if (!WindSource) return;

    // Find the WindDirectionalSourceComponent
    UWindDirectionalSourceComponent* WindComp =
        WindSource->FindComponentByClass<UWindDirectionalSourceComponent>();
    if (WindComp)
    {
        WindComp->Speed = KmhToUE5WindSpeed(CurrentWindKmh);
        // Set wind direction via actor rotation
        FRotator Rot = WindSource->GetActorRotation();
        Rot.Yaw = CurrentDirectionDeg;
        WindSource->SetActorRotation(Rot);
    }
}

void AWindController::UpdateVFX()
{
    // Rain: always on during Cat 0+, intensity scales with wind
    if (RainVFXActor)
    {
        UNiagaraComponent* RainComp = RainVFXActor->FindComponentByClass<UNiagaraComponent>();
        if (RainComp)
        {
            const float RainIntensity = FMath::Clamp(CurrentWindKmh / 300.0f, 0.0f, 1.0f);
            RainComp->SetVariableFloat(FName(TEXT("Intensity")), RainIntensity);
            RainComp->SetVariableFloat(FName(TEXT("WindSpeed")), CurrentWindKmh);
            RainComp->SetVariableVec3(FName(TEXT("WindDirection")),
                FVector(FMath::Cos(FMath::DegreesToRadians(CurrentDirectionDeg)),
                        FMath::Sin(FMath::DegreesToRadians(CurrentDirectionDeg)),
                        0.0f));

            if (CurrentWindKmh > 10.0f && !RainComp->IsActive())
                RainComp->Activate(true);
            else if (CurrentWindKmh <= 10.0f && RainComp->IsActive())
                RainComp->Deactivate();
        }
    }

    // Debris: Cat 2+ (154 km/h)
    if (DebrisVFXActor)
    {
        UNiagaraComponent* DebrisComp = DebrisVFXActor->FindComponentByClass<UNiagaraComponent>();
        if (DebrisComp)
        {
            const bool bShouldBeActive = CurrentCategory >= 2;
            if (bShouldBeActive && !DebrisComp->IsActive())
            {
                DebrisComp->Activate(true);
            }
            else if (!bShouldBeActive && DebrisComp->IsActive())
            {
                DebrisComp->Deactivate();
            }

            if (bShouldBeActive)
            {
                const float DebrisIntensity = FMath::Clamp((CurrentWindKmh - 154.0f) / 150.0f, 0.0f, 1.0f);
                DebrisComp->SetVariableFloat(FName(TEXT("Intensity")), DebrisIntensity);
                DebrisComp->SetVariableFloat(FName(TEXT("WindSpeed")), CurrentWindKmh);
            }
        }
    }

    // Dust/Smoke: Cat 3+
    if (DustVFXActor)
    {
        UNiagaraComponent* DustComp = DustVFXActor->FindComponentByClass<UNiagaraComponent>();
        if (DustComp)
        {
            const bool bShouldBeActive = CurrentCategory >= 3;
            if (bShouldBeActive && !DustComp->IsActive())
                DustComp->Activate(true);
            else if (!bShouldBeActive && DustComp->IsActive())
                DustComp->Deactivate();

            if (bShouldBeActive)
            {
                const float DustIntensity = FMath::Clamp((CurrentWindKmh - 178.0f) / 100.0f, 0.0f, 1.0f);
                DustComp->SetVariableFloat(FName(TEXT("Intensity")), DustIntensity);
            }
        }
    }
}

void AWindController::UpdateDestruction()
{
    // Only apply destruction forces at Cat 3+ (178+ km/h)
    if (CurrentWindKmh < CrackThresholdKmh) return;

    // Calculate force based on wind speed
    // Quadratic scaling: F = k * v^2 (wind pressure formula)
    const float NormalizedSpeed = (CurrentWindKmh - CrackThresholdKmh) /
        (CollapseThresholdKmh - CrackThresholdKmh);
    const float Force = FMath::Clamp(NormalizedSpeed * NormalizedSpeed, 0.0f, 1.0f) *
        DestructionForceMultiplier * 1000000.0f; // Scale to UE5 force units

    for (AActor* Building : DestructibleBuildings)
    {
        if (Building && Building->IsValidLowLevel())
        {
            ApplyDestructionForce(Building, Force);
        }
    }
}

void AWindController::ApplyDestructionForce(AActor* Building, float Force)
{
    if (!Building) return;

    // Apply radial strain field to Geometry Collection
    // This triggers Chaos fracture simulation
    UFieldSystemComponent* FieldComp = Building->FindComponentByClass<UFieldSystemComponent>();
    if (FieldComp)
    {
        // Direction vector from wind direction
        const FVector WindDir(
            FMath::Cos(FMath::DegreesToRadians(CurrentDirectionDeg)),
            FMath::Sin(FMath::DegreesToRadians(CurrentDirectionDeg)),
            -0.1f // Slight downward component
        );

        // Apply external strain in wind direction
        // The actual Chaos field setup requires Blueprint configuration
        // for the specific field nodes (ExternalStrain, DisableField, etc.)
        FieldComp->ApplyPhysicsField(
            true, // bEnabled
            EFieldPhysicsType::Field_ExternalClusterStrain,
            nullptr, // MetaData (use default)
            FieldComp // Command
        );
    }
}
