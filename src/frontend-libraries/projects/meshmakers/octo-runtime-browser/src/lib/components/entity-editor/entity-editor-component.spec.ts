import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ApolloTestingModule } from "apollo-angular/testing";
import { EntityEditorComponent } from "./entity-editor-component";
import { ReactiveFormsModule } from "@angular/forms";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";

describe("EntityEditorComponent", () => {
  let component: EntityEditorComponent;
  let fixture: ComponentFixture<EntityEditorComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideAnimationsAsync()],
      imports: [
        EntityEditorComponent,
        ApolloTestingModule,
        ReactiveFormsModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntityEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
