import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AbstractDetailsComponent, CommonValidators } from '@meshmakers/shared-ui-legacy';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  website: string;
  password: string;
  confirmPassword: string;
  role: string;
  notes: string;
}

@Component({
  selector: 'app-details-demo',
  standalone: false,
  templateUrl: './details-demo.component.html',
  styleUrls: ['./details-demo.component.scss']
})
export class DetailsDemoComponent extends AbstractDetailsComponent<UserProfile> {

  constructor(private fb: FormBuilder) {
    const form: FormGroup = fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, CommonValidators.phoneNumber()]],
      website: ['', CommonValidators.httpUri()],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, CommonValidators.ensureSameValue('password')]],
      role: ['user'],
      notes: ['', CommonValidators.conditionalRequired('role', (role: string) => role === 'admin')],
    });
    super(form);

    // Trigger re-validation of dependent controls when role changes
    this.ownerForm.get('role')?.valueChanges.subscribe(() => {
      this.ownerForm.get('notes')?.updateValueAndValidity();
    });

    // Trigger re-validation of confirmPassword when password changes
    this.ownerForm.get('password')?.valueChanges.subscribe(() => {
      this.ownerForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  simulateLoad(): void {
    this.onProgressStarting();

    setTimeout(() => {
      this.entity = {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: '+49 170 1234567',
        website: 'https://example.com',
        password: 'secret123',
        confirmPassword: 'secret123',
        role: 'admin',
        notes: 'System administrator',
      };
      this.ownerForm.patchValue(this.entity);
      this.onProgressCompleted();
    }, 2000);
  }

  resetForm(): void {
    this.entity = null;
    this.ownerForm.reset({ role: 'user' });
    this.loading = false;
  }
}
