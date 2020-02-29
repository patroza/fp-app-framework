#!/bin/sh
pwd=$PWD

RESULT=0

for i in "samples/basic" "packages/fp-ts-extensions" "packages/framework" "packages/hosting.koa" "packages/io.diskdb"
	do
    cd $i

    echo "Running eslint autofix for ${i}"
    yarn lint --fix
    echo "Eslint autofix finished for ${i}"

    echo "Running prettier for ${i}"
    yarn prettier --write "src/**/*.ts" "src/**/*.tsx"
    echo "Prettier finished for ${i}"

    if [ "$?" -gt 0 ]
    then
      RESULT=`expr $RESULT + 1`
    fi
    cd $pwd
  done

exit $RESULT

