FROM raspbian/stretch

RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN apt install -y cmake automake autoconf libtool pkg-config nodejs

RUN mkdir -p /usr/local/src

WORKDIR /usr/local/src

RUN git clone https://github.com/NXPNFCLinux/linux_libnfc-nci.git

WORKDIR /usr/local/src/linux_libnfc-nci

RUN ./bootstrap && ./configure --enable-i2c && make && make install

RUN mkdir -p /var/run/rpi-tapstack

WORKDIR /var/run/rpi-tapstack

ADD . .

RUN npm install

CMD node start
