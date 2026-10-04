using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace FormAndFileValidator.Mvc
{
    /// <summary>
    /// Razor helpers for ASP.NET MVC 5. Put <see cref="FormRulesAttribute"/> on the model, validate on the server with <c>ModelState.IsValid</c>
    /// as usual, and give the browser the same rules:
    /// <code>
    /// @model SignupModel
    /// &lt;script src="~/Scripts/validator.min.js"&gt;&lt;/script&gt;
    /// @using (Html.BeginForm("Signup", "Account", FormMethod.Post, new { id = "signup" })) { ... }
    /// @Html.FormValidatorInit("signup")                                          @* direct submit: a valid form is posted by the browser *@
    /// @Html.FormValidatorInit("signup", "{ onSubmit: window.sendSignup }")       @* AJAX: your function gets the validated values *@
    /// </code>
    /// </summary>
    public static class FormRulesHtmlHelpers
    {
        /// <summary>A script element that calls <c>FormValidator.init</c> with the rules of the model's [FormRules] properties.</summary>
        /// <param name="html">The Razor helper.</param>
        /// <param name="formId">The id of the form element the rules apply to.</param>
        /// <param name="configScript">Optional JavaScript for the validator <c>config</c> (your own trusted code), for example <c>"{ onSubmit: window.sendSignup }"</c>.</param>
        public static IHtmlString FormValidatorInit<TModel>(this HtmlHelper<TModel> html, string formId, string configScript = null)
        {
            return new HtmlString("<script>" + ModelRules.InitScript(typeof(TModel), formId, configScript) + "</script>");
        }

        /// <summary>Only the rules object (<c>{"Email":["required","email"],...}</c>), for your own script. Escaped for use inside a script element.</summary>
        public static IHtmlString FormRulesJson<TModel>(this HtmlHelper<TModel> html)
        {
            char bs = (char)92;
            return new HtmlString(ModelRules.ToJson<TModel>().Replace("<", bs + "u003c").Replace(">", bs + "u003e").Replace("&", bs + "u0026"));
        }

        /// <summary>
        /// The browser configs of the model's [FileRules] properties, keyed by field name: <c>{"Avatar":{"allowedExtensions":["png"],"maxFileSizeMB":5}}</c>.
        /// Use it with <c>FileValidator.guard(input, config)</c> or <c>FileValidator.widget(...)</c>. Escaped for use inside a script element.
        /// </summary>
        public static IHtmlString FileRulesJson<TModel>(this HtmlHelper<TModel> html)
        {
            return new HtmlString(ModelFileRules.ToJson<TModel>());
        }
    }

    /// <summary>For AJAX actions: answer with the same error shape the browser understands.</summary>
    public static class ModelStateExtensions
    {
        /// <summary>
        /// The first error message of each field, <c>{ "Email": "Please enter a valid email address." }</c>. Return it as
        /// <c>Json(new { errors = ModelState.ToErrorMap() })</c> with status 422 and the browser shows it on the fields (<c>setErrors</c> / <c>onSubmit</c>).
        /// </summary>
        public static IDictionary<string, string> ToErrorMap(this ModelStateDictionary state)
        {
            return state.Where(kv => kv.Value.Errors.Count > 0 && !string.IsNullOrEmpty(kv.Key))
                        .ToDictionary(kv => kv.Key, kv => kv.Value.Errors.Select(e => e.ErrorMessage).FirstOrDefault(m => !string.IsNullOrEmpty(m)) ?? "Invalid value.");
        }
    }
}
