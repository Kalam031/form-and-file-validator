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
    /// @Html.FormValidatorInit("signup")
    /// </code>
    /// </summary>
    public static class FormRulesHtmlHelpers
    {
        /// <summary>A script element that calls <c>FormValidator.init</c> with the rules of the model's [FormRules] properties.</summary>
        public static IHtmlString FormValidatorInit<TModel>(this HtmlHelper<TModel> html, string formId)
        {
            return new HtmlString("<script>" + ModelRules.InitScript(typeof(TModel), formId) + "</script>");
        }

        /// <summary>Only the rules object (<c>{"Email":["required","email"],...}</c>), for your own script. Escaped for use inside a script element.</summary>
        public static IHtmlString FormRulesJson<TModel>(this HtmlHelper<TModel> html)
        {
            char bs = (char)92;
            return new HtmlString(ModelRules.ToJson<TModel>().Replace("<", bs + "u003c").Replace(">", bs + "u003e").Replace("&", bs + "u0026"));
        }
    }
}
