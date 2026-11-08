import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AdminAuthService } from '../../core/auth/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login-wrap">
      <div class="login-card card">
        <div class="brand">
          <span class="logo">C2C</span>
          <div>
            <h1>Admin C2C Nearby</h1>
            <p>Dasbor moderasi & operasional</p>
          </div>
        </div>

        <p class="intro">
          Khusus staf admin: masuk dengan email dan kata sandi yang terdaftar
          di server. Akun pengguna biasa tetap masuk lewat aplikasi dengan
          Firebase. Peran dan izin dibaca ulang dari server pada setiap
          permintaan.
        </p>

        @if (auth.error(); as message) {
          <div class="alert error">{{ message }}</div>
        }

        <form
          class="form"
          [formGroup]="form"
          (ngSubmit)="signIn()"
        >
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              autofocus
              autocomplete="username"
              [formControl]="form.controls.email"
              placeholder="email@contoh.com"
            >
          </div>

          <div class="field">
            <label for="password">Kata sandi</label>
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              [formControl]="form.controls.password"
              placeholder="Kata sandi"
            >
          </div>

          <button
            class="btn btn-primary sign-in"
            type="submit"
            [disabled]="auth.loading() || form.invalid"
          >
            <span class="ms">login</span>
            {{ auth.loading() ? 'Menghubungkan…' : 'Masuk' }}
          </button>
        </form>

        <p class="foot">
          Akun admin terdaftar di server dengan email dan password_hash.
          Sesi memakai token admin dari backend, bukan Firebase.
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .login-wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: radial-gradient(circle at 20% 15%, var(--primary-soft), transparent 55%),
          var(--bg);
      }
      .login-card {
        width: min(440px, 100%);
        padding: 28px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .logo {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 14px;
        background: var(--primary);
        color: #fff;
        font-weight: 800;
        font-size: 13px;
        letter-spacing: 0.5px;
      }
      h1 {
        margin: 0;
        font-size: 18px;
        font-weight: 800;
      }
      .brand p {
        margin: 0;
        font-size: 12px;
        color: var(--text-secondary);
      }
      .intro,
      .foot {
        margin: 0;
        font-size: 12.5px;
        line-height: 1.6;
        color: var(--text-secondary);
      }
      .alert {
        padding: 10px 12px;
        border-radius: 12px;
        font-size: 12.5px;
        line-height: 1.5;
      }
      .alert.error {
        background: var(--danger-soft);
        color: var(--danger);
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field label {
        font-size: 12px;
        font-weight: 600;
      }
      .field input {
        padding: 11px 12px;
        border: 1px solid var(--border);
        border-radius: 10px;
        font-size: 14px;
        outline: none;
      }
      .field input:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-soft);
      }
      .sign-in {
        justify-content: center;
        padding: 11px 16px;
        font-size: 13px;
      }
    `,
  ],
})
export class AdminLoginComponent {
  readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  async signIn(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    const ok = await this.auth.loginWithEmailPassword(
      this.form.getRawValue().email as string,
      this.form.getRawValue().password as string,
    );
    if (ok) {
      await this.router.navigateByUrl('/dashboard');
    }
  }
}