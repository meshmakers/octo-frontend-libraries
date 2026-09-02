import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiNewAppDialogComponent } from './ai-new-app-dialog.component';
import { AiAppTemplateDto, AiNewAppSubmission } from '../../models/ai-app-template';

describe('AiNewAppDialogComponent', () => {
    let fixture: ComponentFixture<AiNewAppDialogComponent>;

    const templates: readonly AiAppTemplateDto[] = [
        {
            id: 'crud-list',
            name: 'CRUD List + Detail',
            description: 'Angular list/detail screen over one CK type.',
            jobKind: 'Application',
            goalTemplate: 'Generate a CRUD list+detail app for {{primaryEntity}}. Project name: {{projectName}}.',
            requiredPlaceholders: ['projectName', 'primaryEntity'],
        },
        {
            id: 'dashboard',
            name: 'Dashboard',
            description: 'Kendo charts page.',
            jobKind: 'Application',
            goalTemplate: 'Dashboard for {{primaryEntity}} ({{projectName}}).',
            requiredPlaceholders: ['projectName', 'primaryEntity'],
        },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AiNewAppDialogComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(AiNewAppDialogComponent);
        fixture.componentRef.setInput('templates', templates);
        fixture.componentRef.setInput('tenantName', 'acme');
        fixture.detectChanges();
    });

    it('renders one entry per template in the catalogue', () => {
        const entries = fixture.nativeElement.querySelectorAll('.mm-ai-new-app__template');
        expect(entries.length).toBe(2);
        expect(entries[0].textContent).toContain('CRUD List + Detail');
        expect(entries[1].textContent).toContain('Dashboard');
    });

    it('renders the tenant name in the header so the operator confirms the scope', () => {
        const header = fixture.nativeElement.querySelector('.mm-ai-new-app__title');
        expect(header.textContent).toContain('acme');
    });

    it('keeps Submit disabled until a template is picked AND every required field is filled', () => {
        const submitButton: HTMLButtonElement = fixture.nativeElement.querySelector('.mm-ai-new-app__btn--submit');
        expect(submitButton.disabled).toBe(true);

        // Pick the first template — but no fields filled yet.
        const firstTemplateRadio: HTMLInputElement = fixture.nativeElement.querySelectorAll('.mm-ai-new-app__template input[type="radio"]')[0];
        firstTemplateRadio.dispatchEvent(new Event('change'));
        fixture.detectChanges();
        expect(submitButton.disabled).toBe(true);

        // Fill projectName only — primaryEntity still empty.
        setInputValue('#mm-ai-new-app-project-name', 'customer-list');
        expect(submitButton.disabled).toBe(true);

        // Fill both — Submit becomes enabled.
        setInputValue('#mm-ai-new-app-primary-entity', 'Customer');
        expect(submitButton.disabled).toBe(false);
    });

    it('previews the rendered Goal once every placeholder has a value', () => {
        pickFirstTemplate();
        setInputValue('#mm-ai-new-app-project-name', 'customer-list');
        setInputValue('#mm-ai-new-app-primary-entity', 'Customer');

        const preview = fixture.nativeElement.querySelector('.mm-ai-new-app__preview');
        expect(preview.textContent.trim()).toBe('Generate a CRUD list+detail app for Customer. Project name: customer-list.');
    });

    it('emits the rendered Goal + the picked template on Submit', () => new Promise<void>((done) => {
        pickFirstTemplate();
        setInputValue('#mm-ai-new-app-project-name', 'customer-list');
        setInputValue('#mm-ai-new-app-primary-entity', 'Customer');

        fixture.componentInstance.confirmed.subscribe((s: AiNewAppSubmission) => {
            expect(s.templateId).toBe('crud-list');
            expect(s.jobKind).toBe('Application');
            expect(s.projectName).toBe('customer-list');
            expect(s.primaryEntity).toBe('Customer');
            expect(s.goal).toBe('Generate a CRUD list+detail app for Customer. Project name: customer-list.');
            done();
        });

        fixture.nativeElement
            .querySelector('.mm-ai-new-app__btn--submit')
            .click();
    }));

    it('emits cancel on the X button', () => new Promise<void>((done) => {
        fixture.componentInstance.cancelled.subscribe(() => done());
        fixture.nativeElement.querySelector('.mm-ai-new-app__close').click();
    }));

    function pickFirstTemplate(): void {
        const radio: HTMLInputElement = fixture.nativeElement.querySelectorAll('.mm-ai-new-app__template input[type="radio"]')[0];
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
        fixture.detectChanges();
    }

    function setInputValue(selector: string, value: string): void {
        const input: HTMLInputElement = fixture.nativeElement.querySelector(selector);
        input.value = value;
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
    }
});
