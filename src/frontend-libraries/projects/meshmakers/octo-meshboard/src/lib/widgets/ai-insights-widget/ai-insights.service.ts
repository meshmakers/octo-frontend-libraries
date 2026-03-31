import { Injectable } from '@angular/core';
import { AnyWidgetConfig, KpiWidgetConfig, GaugeWidgetConfig } from '../../models/meshboard.models';

export interface AiInsight {
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'success' | 'critical';
}

export interface AiInsightContext {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  maxInsights?: number;
  domainContext?: string;
  widgetSummaries: WidgetContextSummary[];
}

interface WidgetContextSummary {
  title: string;
  type: string;
  dataPoints: { label: string; value: string }[];
}

@Injectable({ providedIn: 'root' })
export class AiInsightsService {

  async generateInsights(context: AiInsightContext): Promise<AiInsight[]> {
    if (context.apiKey) {
      return this.callClaudeApi(context);
    }
    return this.getSimulatedInsights(context);
  }

  gatherWidgetContext(widgets: AnyWidgetConfig[]): WidgetContextSummary[] {
    return widgets
      .filter(w => w.type !== 'aiInsights')
      .map(w => this.extractWidgetSummary(w))
      .filter(s => s.dataPoints.length > 0 || s.type !== 'unknown');
  }

  private extractWidgetSummary(widget: AnyWidgetConfig): WidgetContextSummary {
    const summary: WidgetContextSummary = {
      title: widget.title,
      type: widget.type,
      dataPoints: []
    };

    if (widget.type === 'kpi') {
      const kpi = widget as KpiWidgetConfig;
      if (kpi.staticValue) {
        summary.dataPoints.push({ label: 'value', value: `${kpi.staticValue}${kpi.suffix ?? ''}` });
      }
      if (kpi.comparisonText) {
        summary.dataPoints.push({ label: 'comparison', value: kpi.comparisonText });
      }
    }

    if (widget.type === 'gauge') {
      const gauge = widget as GaugeWidgetConfig;
      if (gauge.valueAttribute) {
        summary.dataPoints.push({ label: 'attribute', value: gauge.valueAttribute });
      }
    }

    return summary;
  }

  private async callClaudeApi(context: AiInsightContext): Promise<AiInsight[]> {
    const systemPrompt = context.systemPrompt ?? this.buildDefaultSystemPrompt(context);
    const userMessage = this.buildUserMessage(context);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': context.apiKey!,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: context.model ?? 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    return this.parseInsightsFromResponse(text, context.maxInsights ?? 4);
  }

  private buildDefaultSystemPrompt(context: AiInsightContext): string {
    const domain = context.domainContext ?? 'energy management';
    return `You are an AI advisor for an industrial ${domain} dashboard.
Analyze the provided dashboard data and generate actionable insights.
Respond ONLY with a JSON array of insight objects. Each object has:
- "title": short headline (max 8 words)
- "description": actionable recommendation (1-2 sentences, German language)
- "severity": one of "info", "warning", "success", "critical"

Focus on energy efficiency, cost savings, anomalies, and optimization opportunities.
Return at most ${context.maxInsights ?? 4} insights. No markdown, no explanation, only the JSON array.`;
  }

  private buildUserMessage(context: AiInsightContext): string {
    const widgetData = context.widgetSummaries.map(w => ({
      widget: w.title,
      type: w.type,
      data: w.dataPoints
    }));
    return `Current dashboard state:\n${JSON.stringify(widgetData, null, 2)}`;
  }

  private parseInsightsFromResponse(text: string, maxInsights: number): AiInsight[] {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return this.fallbackInsights();

      const parsed = JSON.parse(jsonMatch[0]) as AiInsight[];
      return parsed.slice(0, maxInsights).map(i => ({
        title: i.title ?? 'Insight',
        description: i.description ?? '',
        severity: (['info', 'warning', 'success', 'critical'].includes(i.severity) ? i.severity : 'info') as AiInsight['severity']
      }));
    } catch {
      return this.fallbackInsights();
    }
  }

  private getSimulatedInsights(_context: AiInsightContext): AiInsight[] {
    const hour = new Date().getHours();
    const insights: AiInsight[] = [
      {
        title: 'Lastspitze prognostiziert',
        description: 'Basierend auf dem aktuellen Lastprofil wird die 3.000 kW Grenze voraussichtlich um 14:30 Uhr erreicht. Lastabwurf der HVAC-Anlage um 30% empfohlen.',
        severity: 'warning'
      },
      {
        title: 'PV-Optimierung möglich',
        description: hour < 14
          ? 'Wettervorhersage: sonnig bis 16:00 Uhr. Energieintensive Prozesse jetzt starten — erwartete PV-Einspeisung von 810 kW nutzen.'
          : 'PV-Einspeisung sinkt ab 16:00 Uhr. Batteriespeicher auf 80% laden, solange Überschuss verfügbar ist.',
        severity: 'success'
      },
      {
        title: 'Kompressoranlage C3 auffällig',
        description: 'Verbrauch 18% über dem 30-Tage-Durchschnitt bei gleicher Auslastung. Mögliche Ursache: verschlissene Dichtungen oder Druckverlust. Wartung empfohlen.',
        severity: 'warning'
      },
      {
        title: 'CO2-Budget im Zeitplan',
        description: 'Mit 489 t von 680 t Budget (72%) und 9 Monaten verbleibend liegt der Verbrauch 4% unter Plan. Zertifikats-Beschaffung kann verschoben werden.',
        severity: 'success'
      }
    ];

    return insights;
  }

  private fallbackInsights(): AiInsight[] {
    return [{
      title: 'Analyse nicht verfügbar',
      description: 'Die KI-Analyse konnte nicht durchgeführt werden. Bitte prüfen Sie den API-Schlüssel in den Widget-Einstellungen.',
      severity: 'info'
    }];
  }
}
