import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { UserProfile } from '../models/auth';
import { SessionService } from '../services/session.service';
import { Task } from '../models/task';
import { getErrorMessage } from '../utils/error-message';
import { formatTaskLabel } from '../utils/legacy-format';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Completado',
  RESUELTO: 'Resuelto',
  COMPLETED: 'Completado'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: Task[] = [];
  visibleTasks: Task[] = [];
  user: UserProfile = {};
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private session: SessionService
  ) {}

  statusLabel(status: string): string {
    return STATUS_LABELS[(status || '').toUpperCase()] || status;
  }

  async ngOnInit(): Promise<void> {
    const token = this.session.getToken();
    this.user = this.session.getUser();
    if (!token) {
      await this.router.navigate(['/login']);
      return;
    }
    try {
      const response = await axios.get<Task[]>(
        'http://localhost:8000/api/tasks?owner=' + String(this.user.username || ''),
        {
        headers: { Authorization: 'Bearer ' + token }
        }
      );
      const tasks = response.data;
      const tmp: Task[] = [];
      for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].status !== 'ARCHIVED') {
          tasks[i].label = formatTaskLabel(tasks[i]);
          tmp.push(tasks[i]);
        }
      }
      tmp.sort((a, b) => a.priority > b.priority ? -1 : 1);
      // axios resuelve a veces fuera de la zona de Angular (más aún llegando
      // por navegación desde el login): forzamos volver a entrar a la zona
      // y disparamos detectChanges a mano para no depender de que Angular
      // lo detecte solo.
      this.zone.run(() => {
        this.tasks = tasks;
        this.visibleTasks = tmp;
        this.loading = false;
        this.cdr.detectChanges();
      });
    } catch (error: unknown) {
      this.zone.run(() => {
        this.error = getErrorMessage(error, 'detail', 'No se pudo cargar el dashboard');
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async logout(): Promise<void> {
    this.session.clearSession();
    await this.router.navigate(['/login']);
  }
}
