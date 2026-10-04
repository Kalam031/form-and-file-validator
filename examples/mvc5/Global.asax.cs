using System.Web;
using System.Web.Mvc;
using System.Web.Routing;

namespace Mvc5Demo
{
    public class MvcApplication : HttpApplication
    {
        protected void Application_Start()
        {
            RouteTable.Routes.MapRoute(
                name: "Default",
                url: "{controller}/{action}/{id}",
                defaults: new { controller = "Account", action = "Signup", id = UrlParameter.Optional });
        }
    }
}
