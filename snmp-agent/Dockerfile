FROM ubuntu:22.04

# snmpd is net-snmp's agent daemon — it's what real Linux servers and many
# Linux-based network devices run to answer SNMP queries. It supports
# HOST-RESOURCES-MIB (CPU, memory) out of the box, reading real data from
# /proc inside this container.
RUN apt-get update && \
    apt-get install -y --no-install-recommends snmpd && \
    rm -rf /var/lib/apt/lists/*

COPY snmpd.conf /etc/snmp/snmpd.conf

EXPOSE 161/udp

# -f = run in foreground (required for Docker), -Lo = log to stdout so
# `docker compose logs` shows anything useful if it fails to start.
CMD ["snmpd", "-f", "-Lo", "-c", "/etc/snmp/snmpd.conf"]
