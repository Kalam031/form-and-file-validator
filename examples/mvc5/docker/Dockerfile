# Hosts a built ASP.NET MVC 5 site on Mono's ASP.NET server (xsp4). Mount the site folder (with bin/, Views/, Web.config) at /app.
FROM mono:latest
# the base image is Debian buster, whose package servers were moved to the archive
RUN sed -i 's|deb.debian.org|archive.debian.org|g; s|security.debian.org|archive.debian.org|g; /buster-updates/d' /etc/apt/sources.list \
 && apt-get -o Acquire::Check-Valid-Until=false update \
 && apt-get install -y procps mono-xsp4 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
EXPOSE 8081
CMD ["xsp4", "--root", "/app", "--port", "8081", "--address", "0.0.0.0", "--nonstop"]
