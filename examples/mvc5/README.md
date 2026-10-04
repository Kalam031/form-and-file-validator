# ASP.NET MVC 5 sample

A real ASP.NET MVC 5 site (.NET Framework 4.8, System.Web, Razor, Global.asax) that uses form-and-file-validator.

- `Models/SignupModel.cs`: the rules, written once with `[FormRules(...)]`.
- `Controllers/AccountController.cs`: nothing special, `ModelState.IsValid` as always.
- `Views/Account/Signup.cshtml`: `@Html.FormValidatorInit("signup")` gives the browser the same rules.
- `Scripts/validator.min.js`: copy from `node_modules/form-and-file-validator/dist/validator.min.js`.

Build: `dotnet build` (output goes to `bin\`). Run with IIS Express / IIS (Windows), or Mono's `xsp4` (Linux, Docker):
see `run-docker.sh`, which builds in a .NET SDK container, hosts the site on Mono and drives it with a real browser.
