using FormAndFileValidator;

namespace Mvc5Demo.Models
{
    /// <summary>
    /// The rules are written ONCE, as the same JSON the browser reads. The server checks them through ModelState (DataAnnotations),
    /// and Html.FormValidatorInit gives the very same rules to the browser. Dates are kept as text, with their format named.
    /// </summary>
    public class SignupModel
    {
        [FormRules(@"[""required"", ""email""]")]
        public string Email { get; set; }

        [FormRules(@"[""required"", {""type"":""pwcheck"",""minLength"":8,""requireUppercase"":true,""requireDigit"":true}]")]
        public string Password { get; set; }

        [FormRules(@"[{""type"":""equalTo"",""target"":""Password""}]")]
        public string ConfirmPassword { get; set; }

        [FormRules(@"[""required"", {""type"":""date"",""format"":""d/M/y""}, {""type"":""maxDate"",""format"":""d/M/y"",""max"":""today""}]")]
        public string BirthDate { get; set; }

        [FormRules(@"[{""type"":""url""}]")]
        public string Website { get; set; }

        [FormRules(@"[""required"", {""type"":""alpha""}, {""type"":""minlength"",""min"":2}]")]
        public string FirstName { get; set; }
    }
}
