import assert from "node:assert/strict";
import type { ChangedFile } from "../../src/analysis/changed-file.js";
import { defaultConfig, prismConfigSchema } from "../../src/config/schema.js";
import { massAssignmentRule } from "../../src/rules/mass-assignment.js";

function added(path: string, lines: string[]): ChangedFile {
  return { path, status: "added", additions: lines.length, deletions: 0, patch: [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n") };
}

function findings(files: ChangedFile[], config = defaultConfig) {
  return massAssignmentRule.run({ files, config, configPath: ".prism-review.yml", changedPaths: new Set(files.map((file) => file.path)) });
}

// Built at runtime, so this file does not contain the marker it looks for.
const permitAll = ["permit", "!"].join("");

export function testMassAssignmentReportsOneFindingPerFile(): void {
  const [finding, ...rest] = findings([
    added("app/controllers/users_controller.rb", [
      "def user_params",
      `  params.require(:user).${permitAll}`,
      "end",
      "def legacy",
      "  User.create(params.to_unsafe_h)",
      "end"
    ])
  ]);

  assert.equal(rest.length, 0);
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.title, "Mass assignment");
  assert.deepEqual(finding?.lines, [2, 5]);
  assert.equal(
    finding?.message,
    "Lines 2, 5 let a request set fields it should not, such as a role or an owner: the code permits every request parameter."
  );
}

export function testMassAssignmentReadsEachFramework(): void {
  const cases: Array<[string, string[]]> = [
    ["app/forms.py", ["class ProfileForm(forms.ModelForm):", "    class Meta:", "        model = Profile", '        fields = "__all__"']],
    ["api/serializers.py", ["class UserSerializer(serializers.ModelSerializer):", "    class Meta:", "        fields = '__all__'"]],
    ["app/views.py", ["user = User.objects.create(**request.POST)"]],
    ["app/views.py", ["serializer_data = Account(**request.data)"]],
    ["app/routes.py", ["user = User(**request.get_json())"]],
    ["app/Models/User.php", ["    protected $guarded = [];"]],
    ["app/Providers/AppServiceProvider.php", ["        Model::unguard();"]],
    ["src/routes/users.js", ["const user = await User.create(req.body);"]],
    ["src/routes/users.js", ["await User.findByIdAndUpdate(req.params.id, req.body, { new: true });"]],
    ["src/routes/users.ts", ["const user = await prisma.user.create({ data: req.body });"]],
    ["src/routes/users.ts", ["await repo.save({ ...req.body });"]],
    ["src/routes/users.ts", ["Object.assign(user, req.body);"]],
    ["src/routes/users.ts", ["const user = new User(req.body);"]],
    ["Controllers/UsersController.cs", ["if (await TryUpdateModelAsync(user))"]]
  ];
  for (const [path, lines] of cases) {
    assert.equal(findings([added(path, lines)]).length, 1, `${path}: ${lines.at(-1)}`);
  }
}

export function testMassAssignmentSkipsListedFields(): void {
  const safe: Array<[string, string[]]> = [
    ["app/controllers/users_controller.rb", ["  params.require(:user).permit(:name, :email)"]],
    ["app/models/user.rb", [`attributes = attributes.slice(*confirmation_keys).${permitAll}.to_h`]],
    ["app/forms.py", ["class ProfileForm(forms.ModelForm):", "    class Meta:", '        fields = ["name", "email"]']],
    // django-filter chooses filterable fields with the same option.
    ["app/filters.py", ["class UserFilter(django_filters.FilterSet):", "    class Meta:", '        fields = "__all__"']],
    ["app/Models/User.php", ["    protected $fillable = ['name', 'email'];", "    protected $guarded = ['is_admin'];"]],
    ["src/routes/users.js", ["const { name, email } = req.body;", "const user = await User.create({ name, email });"]],
    ["src/webhooks.js", ['const signature = crypto.createHmac("sha256", secret).update(req.body).digest("hex");']],
    ["Controllers/UsersController.cs", ['await TryUpdateModelAsync(user, "", u => u.Name, u => u.Email);']],
    // Comments.
    ["app/controllers/users_controller.rb", [`  # params.${permitAll}`]]
  ];
  for (const [path, lines] of safe) {
    assert.deepEqual(findings([added(path, lines)]), [], `${path}: ${lines.at(-1)}`);
  }
}

export function testMassAssignmentSkipsTestsAndDocs(): void {
  const line = "const user = await User.create(req.body);";

  assert.deepEqual(findings([added("src/users.test.ts", [line]), added("docs/api.md", [line]), added("fixtures/app/users.js", [line])]), []);
}

export function testMassAssignmentCanBeDisabled(): void {
  const config = prismConfigSchema.parse({ rules: { massAssignment: { enabled: false } } });

  assert.deepEqual(findings([added("src/users.js", ["const user = await User.create(req.body);"])], config), []);
}
