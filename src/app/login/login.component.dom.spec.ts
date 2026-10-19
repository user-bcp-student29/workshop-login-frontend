// @vitest-environment jsdom
import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { SessionService } from '../services/session.service';

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

describe('LoginComponent template characterization', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<LoginComponent>>;
  let component: LoginComponent;

  beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
  });

  beforeEach(async () => {
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const session = {
      getPreferences: () => ({ theme: 'light', showTips: true, compact: false }),
      saveSession: vi.fn()
    };
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: SessionService, useValue: session }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('renders a benign user marker as an element in the current template', async () => {
    component.username = '<em>student</em>';
    component.password = 'Workshop123!';
    vi.mocked(axios.post).mockRejectedValue(new Error('Backend detail'));

    await component.login();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.message em')?.textContent).toBe('student');
    expect(fixture.nativeElement.textContent).toContain('Backend detail');
  });
});