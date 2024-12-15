import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const DEFAULT_RECAPTCHA_SITE_KEY = '6LdCfJwqAAAAAPYzwte1Ie0A-hGzRT4od1ZXJ-qe';

@Injectable({
  providedIn: 'root'
})
export class RecaptchaService {
  private readonly siteKey: string;

  constructor() {
    // Use environment recaptcha key if available, otherwise use default
    this.siteKey = environment.recaptcha?.siteKey || DEFAULT_RECAPTCHA_SITE_KEY;
    
    // Initialize reCAPTCHA if needed
    this.initializeRecaptcha();
  }

  private initializeRecaptcha(): void {
    // Add any initialization logic here
    console.log('reCAPTCHA initialized with site key:', this.siteKey);
  }

  async executeRecaptcha(action: string): Promise<string> {
    try {
      const grecaptcha = (window as Window & { grecaptcha?: ReCaptcha }).grecaptcha;
      if (!grecaptcha) {
        throw new Error('reCAPTCHA not loaded');
      }
      return await grecaptcha.execute(this.siteKey, { action });
    } catch (error) {
      console.error('reCAPTCHA execution failed:', error);
      throw error;
    }
  }
}

interface ReCaptcha {
  execute(siteKey: string, options: { action: string }): Promise<string>;
  ready(callback: () => void): void;
} 