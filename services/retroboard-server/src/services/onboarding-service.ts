import { sql } from '../db/connection.js';

const VALID_STEPS = ['welcome', 'create_team', 'invite_members', 'create_sprint', 'start_retro'];

export interface OnboardingData {
  currentStep: string;
  completedSteps: string[];
  skippedSteps: string[];
}

export class OnboardingService {
  async getState(userId: string): Promise<OnboardingData | null> {
    const [user] = await sql`
      SELECT onboarding_completed_at, onboarding_data
      FROM users
      WHERE id = ${userId}
    `;

    // If onboarding is complete, return null
    if (user.onboarding_completed_at) {
      return null;
    }

    // Parse onboarding data or return initial state
    let data = user.onboarding_data;

    // Handle case where JSONB is returned as string
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = null;
      }
    }

    const parsedData = data as OnboardingData | null;
    if (!parsedData) {
      return {
        currentStep: 'welcome',
        completedSteps: [],
        skippedSteps: [],
      };
    }

    return parsedData;
  }

  async updateStep(userId: string, step: string, action: 'complete' | 'skip'): Promise<OnboardingData> {
    if (!VALID_STEPS.includes(step)) {
      throw new Error('Invalid step name');
    }

    const currentState = await this.getState(userId);
    if (!currentState) {
      throw new Error('Onboarding already completed');
    }

    const { completedSteps, skippedSteps } = currentState;

    if (action === 'complete') {
      if (!completedSteps.includes(step)) {
        completedSteps.push(step);
      }
      // Remove from skipped if it was there
      const skippedIndex = skippedSteps.indexOf(step);
      if (skippedIndex > -1) {
        skippedSteps.splice(skippedIndex, 1);
      }
    } else if (action === 'skip') {
      if (!skippedSteps.includes(step)) {
        skippedSteps.push(step);
      }
      // Remove from completed if it was there
      const completedIndex = completedSteps.indexOf(step);
      if (completedIndex > -1) {
        completedSteps.splice(completedIndex, 1);
      }
    }

    // Determine next step
    const currentStepIndex = VALID_STEPS.indexOf(step);
    const nextStepIndex = currentStepIndex + 1;
    const currentStep = nextStepIndex < VALID_STEPS.length ? VALID_STEPS[nextStepIndex] : VALID_STEPS[VALID_STEPS.length - 1];

    const newData = {
      currentStep,
      completedSteps,
      skippedSteps,
    };

    await sql`
      UPDATE users
      SET onboarding_data = ${sql.json(newData)}
      WHERE id = ${userId}
    `;

    return newData;
  }

  async complete(userId: string) {
    await sql`
      UPDATE users
      SET onboarding_completed_at = NOW()
      WHERE id = ${userId}
    `;
  }

  async reset(userId: string) {
    await sql`
      UPDATE users
      SET onboarding_completed_at = NULL,
          onboarding_data = NULL
      WHERE id = ${userId}
    `;
  }

  isValidStep(step: string): boolean {
    return VALID_STEPS.includes(step);
  }
}

export const onboardingService = new OnboardingService();
