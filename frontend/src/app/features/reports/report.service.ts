import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/api';
import { DateRange, TimeReport, isoDate } from './report.models';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/time/report`;

  /** `userId` `null` = everyone's time. */
  get(range: DateRange, userId: number | null): Observable<TimeReport> {
    return this.http.get<TimeReport>(this.url, { params: this.params(range, userId) });
  }

  /** The entries behind the report, one per row. */
  csv(range: DateRange, userId: number | null): Observable<Blob> {
    return this.http.get(`${this.url}/csv`, { params: this.params(range, userId), responseType: 'blob' });
  }

  private params(range: DateRange, userId: number | null): HttpParams {
    let params = new HttpParams().set('from', isoDate(range.from)).set('to', isoDate(range.to));
    if (userId !== null) params = params.set('userId', userId);
    return params;
  }
}
