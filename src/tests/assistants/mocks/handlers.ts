import { http, HttpResponse } from 'msw';
import { mockAssistants } from './data';

export const getAssistantsSuccess = http.get('/api/assistant', () => {
  return HttpResponse.json(mockAssistants);
});

export const getAssistantsError = http.get('/api/assistant', () => {
  return HttpResponse.json({ detail: 'Internal Server Error' }, { status: 500 });
});

export const getAssistantsEmpty = http.get('/api/assistant', () => {
  return HttpResponse.json([]);
});

export const assistantHandlers = [
  getAssistantsSuccess,
  getAssistantsError,
  getAssistantsEmpty
];