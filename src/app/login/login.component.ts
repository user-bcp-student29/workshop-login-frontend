import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import axios from 'axios';
import { LoginPreferences, LoginRequest, LoginResponse } from '../models/auth';
import { getErrorMessage } from '../utils/error-message';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  busy = false;
  message = '';
  preferences: LoginPreferences = { theme: 'light', showTips: true, compact: false };

  constructor(private router: Router, private session: SessionService) {
    this.preferences = this.session.getPreferences();
  }

  async login(): Promise<void> {
    this.message = '';
    if (this.username === null || this.username === undefined || String(this.username).trim() === '') {
      this.message = '<strong>Ingrese un usuario.</strong>';
    } else {
      if (this.password === null || this.password === undefined || String(this.password).trim() === '') {
        this.message = '<strong>Ingrese una contraseña.</strong>';
      } else {
        this.busy = true;
        try {
          const request: LoginRequest = {
            username: this.username,
            password: this.password,
            client: 'angular-workshop'
          };
          const response = await axios.post<LoginResponse>(
            'http://localhost:8080/auth/login',
            request,
            { timeout: 5000 }
          );
          if (response && response.data && response.data.token) {
            this.session.saveSession(response.data.token, response.data.user, this.preferences);
            await this.router.navigate(['/dashboard']);
          } else {
            this.message = '<strong>El backend respondió sin token.</strong>';
          }
        } catch (error: unknown) {
          const backendMessage = getErrorMessage(error, 'message', 'Error desconocido');
          this.message = '<strong>No se pudo autenticar a ' + this.username + '.</strong><br>' + backendMessage;
          console.error(error);
        } finally {
          this.busy = false;
        }
      }
    }
  }
}
