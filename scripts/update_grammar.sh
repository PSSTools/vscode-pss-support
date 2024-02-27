#!/bin/sh

scripts_dir=$(dirname $(realpath $0))
ext_dir=$(dirname $scripts_dir)

if ! test -d $scripts_dir/pssparser; then
   git clone https://github.com/psstools/pssparser ${scripts_dir}/pssparser
fi

cp ${scripts_dir}/pssparser/src/PSSParser.g4 \
   ${scripts_dir}/pssparser/src/PSSLexer.g4 \
   ${ext_dir}/server/src/grammar

rm -rf ${scripts_dir}/pssparser
