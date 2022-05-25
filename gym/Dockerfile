FROM pytorch/pytorch:latest

RUN apt-get -q -y update
RUN apt-get update &&  DEBIAN_FRONTEND=noninteractive apt-get install -y locales
RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    dpkg-reconfigure --frontend=noninteractive locales && \
    update-locale LANG=en_US.UTF-8
ENV LANG en_US.UTF-8

RUN apt-get -q -y install build-essential git gcc vim python3 python3-pip

# https://stable-baselines.readthedocs.io/en/master/guide/install.html
RUN DEBIAN_FRONTEND=noninteractive apt-get -q -y install cmake libopenmpi-dev python3-dev zlib1g-dev

# Install python deps
RUN pip3 install gym opencv-python-headless stable-baselines3[extra] numpy
RUN pip3 install websockets syncer nest_asyncio
