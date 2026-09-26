2025-10-13T06:28:14.390295476Z [inf]  
2025-10-13T06:28:15.580839029Z [inf] [35m[Region: us-east4][0m
2025-10-13T06:28:15.588967641Z [inf] [35m==============
2025-10-13T06:28:15.588992663Z [inf] Using Nixpacks
2025-10-13T06:28:15.588996791Z [inf] ==============
2025-10-13T06:28:15.589000122Z [inf] [0m
2025-10-13T06:28:15.589093476Z [inf] context: 4gvw-1w7L
2025-10-13T06:28:15.693894373Z [inf] ╔══════════════════════════════ Nixpacks v1.38.0 ══════════════════════════════╗
2025-10-13T06:28:15.693927551Z [inf] ║ setup │ nodejs_22, npm-9_x ║
2025-10-13T06:28:15.693932195Z [inf] ║──────────────────────────────────────────────────────────────────────────────║
2025-10-13T06:28:15.693935958Z [inf] ║ install │ npm ci ║
2025-10-13T06:28:15.693945132Z [inf] ║──────────────────────────────────────────────────────────────────────────────║
2025-10-13T06:28:15.693948865Z [inf] ║ build │ npm install && cd server && rm -rf node_modules/.prisma ║
2025-10-13T06:28:15.693952239Z [inf] ║ │ node_modules/@prisma/client && npx prisma generate && cd .. && ║
2025-10-13T06:28:15.693955415Z [inf] ║ │ npm run build ║
2025-10-13T06:28:15.693958610Z [inf] ║──────────────────────────────────────────────────────────────────────────────║
2025-10-13T06:28:15.693962805Z [inf] ║ start │ cd server && npx prisma migrate deploy && npx prisma generate ║
2025-10-13T06:28:15.693967658Z [inf] ║ │ && node dist/server.js ║
2025-10-13T06:28:15.693971177Z [inf] ╚══════════════════════════════════════════════════════════════════════════════╝
2025-10-13T06:28:15.891576170Z [inf] [internal] load build definition from Dockerfile
2025-10-13T06:28:15.891627746Z [inf] [internal] load build definition from Dockerfile
2025-10-13T06:28:15.891657920Z [inf] [internal] load build definition from Dockerfile
2025-10-13T06:28:15.900473010Z [inf] [internal] load build definition from Dockerfile
2025-10-13T06:28:15.902277686Z [inf] [internal] load metadata for ghcr.io/railwayapp/nixpacks:ubuntu-1745885067
2025-10-13T06:28:15.990108087Z [inf] [internal] load metadata for ghcr.io/railwayapp/nixpacks:ubuntu-1745885067
2025-10-13T06:28:15.990365904Z [inf] [internal] load .dockerignore
2025-10-13T06:28:15.990393391Z [inf] [internal] load .dockerignore
2025-10-13T06:28:15.990868729Z [inf] [internal] load .dockerignore
2025-10-13T06:28:15.998663014Z [inf] [internal] load .dockerignore
2025-10-13T06:28:16.005474324Z [inf] [10/10] COPY . /app
2025-10-13T06:28:16.005501139Z [inf] [ 9/10] RUN printf '\nPATH=/app/node_modules/.bin:$PATH' >> /root/.profile
2025-10-13T06:28:16.005510944Z [inf] [ 8/10] RUN npm install && cd server && rm -rf node_modules/.prisma node_modules/@prisma/client && npx prisma generate && cd .. && npm run build
2025-10-13T06:28:16.005518704Z [inf] [ 7/10] COPY . /app/.
2025-10-13T06:28:16.005525119Z [inf] [ 6/10] RUN npm ci
2025-10-13T06:28:16.005532376Z [inf] [ 5/10] COPY . /app/.
2025-10-13T06:28:16.005538488Z [inf] [ 4/10] RUN nix-env -if .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix && nix-collect-garbage -d
2025-10-13T06:28:16.005544654Z [inf] [ 3/10] COPY .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix
2025-10-13T06:28:16.005575911Z [inf] [internal] load build context
2025-10-13T06:28:16.005583559Z [inf] [ 2/10] WORKDIR /app/
2025-10-13T06:28:16.005589044Z [inf] [ 1/10] FROM ghcr.io/railwayapp/nixpacks:ubuntu-1745885067@sha256:d45c89d80e13d7ad0fd555b5130f22a866d9dd10e861f589932303ef2314c7de
2025-10-13T06:28:16.005603725Z [inf] [ 1/10] FROM ghcr.io/railwayapp/nixpacks:ubuntu-1745885067@sha256:d45c89d80e13d7ad0fd555b5130f22a866d9dd10e861f589932303ef2314c7de
2025-10-13T06:28:16.005609464Z [inf] [internal] load build context
2025-10-13T06:28:16.005618714Z [inf] [internal] load build context
2025-10-13T06:28:16.005626313Z [inf] [internal] load build context
2025-10-13T06:28:16.013008781Z [inf] [ 1/10] FROM ghcr.io/railwayapp/nixpacks:ubuntu-1745885067@sha256:d45c89d80e13d7ad0fd555b5130f22a866d9dd10e861f589932303ef2314c7de
2025-10-13T06:28:16.013331216Z [inf] [ 2/10] WORKDIR /app/
2025-10-13T06:28:16.057973877Z [inf] [internal] load build context
2025-10-13T06:28:16.059200128Z [inf] [ 3/10] COPY .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix
2025-10-13T06:28:16.129223794Z [inf] [ 3/10] COPY .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix
2025-10-13T06:28:16.130192345Z [inf] [ 4/10] RUN nix-env -if .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix && nix-collect-garbage -d
2025-10-13T06:28:16.225322586Z [inf] unpacking 'https://github.com/NixOS/nixpkgs/archive/ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.tar.gz' into the Git cache...

2025-10-13T06:28:41.3908243Z [inf] unpacking 'https://github.com/railwayapp/nix-npm-overlay/archive/main.tar.gz' into the Git cache...

2025-10-13T06:28:41.738964Z [inf] installing 'ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7-env'

2025-10-13T06:28:42.225802083Z [inf] these 5 derivations will be built:
/nix/store/6vy68gykpxfphbmmyd59ya88xvrwvvaa-npm-9.9.4.tgz.drv
/nix/store/cjdjkmr6gy2h8l0cra71whgrvy030kx1-libraries.drv
/nix/store/bs6g8vhkfynvlzidhlqbsvnc9wijbaaz-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7-env.drv
/nix/store/w9h0z1lhfwxc0m38f3w5brfdqrzm4wyj-npm.drv

2025-10-13T06:28:42.225818248Z [inf] /nix/store/zr34yihblp8zqam2fjahiiddvnii8gw0-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7-env.drv
these 78 paths will be fetched (122.32 MiB download, 581.57 MiB unpacked):

2025-10-13T06:28:42.225860592Z [inf] /nix/store/cf7gkacyxmm66lwl5nj6j6yykbrg4q5c-acl-2.3.2
/nix/store/a9jgnlhkjkxav6qrc3rzg2q84pkl2wvr-attr-2.5.2
/nix/store/5mh7kaj2fyv8mk4sfq1brwxgc02884wi-bash-5.2p37
/nix/store/j7p46r8v9gcpbxx89pbqlh61zhd33gzv-binutils-2.43.1
/nix/store/df2a8k58k00f2dh2x930dg6xs6g6mliv-binutils-2.43.1-lib
/nix/store/srcmmqi8kxjfygd0hyy42c8hv6cws83b-binutils-wrapper-2.43.1

2025-10-13T06:28:42.225867388Z [inf] /nix/store/wf5zj2gbib3gjqllkabxaw4dh0gzcla3-builder.pl
/nix/store/ivl2v8rgg7qh1jkj5pwpqycax3rc2hnl-bzip2-1.0.8
/nix/store/mglixp03lsp0w986svwdvm7vcy17rdax-bzip2-1.0.8-bin
/nix/store/4s9rah4cwaxflicsk5cndnknqlk9n4p3-coreutils-9.5
/nix/store/pkc7mb4a4qvyz73srkqh4mwl70w98dsv-curl-8.11.0

2025-10-13T06:28:42.225869895Z [inf] /nix/store/p123cq20klajcl9hj8jnkjip5nw6awhz-curl-8.11.0-bin
/nix/store/5f5linrxzhhb3mrclkwdpm9bd8ygldna-curl-8.11.0-dev

2025-10-13T06:28:42.225897355Z [inf] /nix/store/agvks3qmzja0yj54szi3vja6vx3cwkkw-curl-8.11.0-man
/nix/store/00g69vw7c9lycy63h45ximy0wmzqx5y6-diffutils-3.10
/nix/store/74h4z8k82pmp24xryflv4lxkz8jlpqqd-ed-1.20.2
/nix/store/qbry6090vlr9ar33kdmmbq2p5apzbga8-expand-response-params
/nix/store/c4rj90r2m89rxs64hmm857mipwjhig5d-file-5.46
/nix/store/jqrz1vq5nz4lnv9pqzydj0ir58wbjfy1-findutils-4.10.0

2025-10-13T06:28:42.225909835Z [inf] /nix/store/a3c47r5z1q2c4rz0kvq8hlilkhx2s718-gawk-5.3.1
/nix/store/l89iqc7am6i60y8vk507zwrzxf0wcd3v-gcc-14-20241116
/nix/store/bpq1s72cw9qb2fs8mnmlw6hn2c7iy0ss-gcc-14-20241116-lib

2025-10-13T06:28:42.225912523Z [inf] /nix/store/17v0ywnr3akp85pvdi56gwl99ljv95kx-gcc-14-20241116-libgcc

2025-10-13T06:28:42.225928026Z [inf] /nix/store/xcn9p4xxfbvlkpah7pwchpav4ab9d135-gcc-wrapper-14-20241116
/nix/store/65h17wjrrlsj2rj540igylrx7fqcd6vq-glibc-2.40-36
/nix/store/1c6bmxrrhm8bd26ai2rjqld2yyjrxhds-glibc-2.40-36-bin
/nix/store/kj8hbqx4ds9qm9mq7hyikxyfwwg13kzj-glibc-2.40-36-dev

2025-10-13T06:28:42.225938265Z [inf] /nix/store/kryrg7ds05iwcmy81amavk8w13y4lxbs-gmp-6.3.0
/nix/store/a2byxfv4lc8f2g5xfzw8cz5q8k05wi29-gmp-with-cxx-6.3.0

2025-10-13T06:28:42.225942555Z [inf] /nix/store/1m67ipsk39xvhyqrxnzv2m2p48pil8kl-gnu-config-2024-01-01

2025-10-13T06:28:42.225945508Z [inf] /nix/store/aap6cq56amx4mzbyxp2wpgsf1kqjcr1f-gnugrep-3.11

2025-10-13T06:28:42.225950928Z [inf] /nix/store/fp6cjl1zcmm6mawsnrb5yak1wkz2ma8l-gnumake-4.4.1

2025-10-13T06:28:42.225954915Z [inf] /nix/store/abm77lnrkrkb58z6xp1qwjcr1xgkcfwm-gnused-4.9
/nix/store/9cwwj1c9csmc85l2cqzs3h9hbf1vwl6c-gnutar-1.35

2025-10-13T06:28:42.225961789Z [inf] /nix/store/nvvj6sk0k6px48436drlblf4gafgbvzr-gzip-1.13
/nix/store/wwipgdqb4p2fr46kmw9c5wlk799kbl68-icu4c-74.2

2025-10-13T06:28:42.225980952Z [inf] /nix/store/m8w3mf0i4862q22bxad0wspkgdy4jnkk-icu4c-74.2-dev
/nix/store/xmbv8s4p4i4dbxgkgdrdfb0ym25wh6gk-isl-0.20
/nix/store/2wh1gqyzf5xsvxpdz2k0bxiz583wwq29-keyutils-1.6.3-lib
/nix/store/milph81dilrh96isyivh5n50agpx39k2-krb5-1.21.3

2025-10-13T06:28:42.225989315Z [inf] /nix/store/b56mswksrql15knpb1bnhv3ysif340kd-krb5-1.21.3-dev
/nix/store/v9c1s50x7magpiqgycxxkn36avzbcg0g-krb5-1.21.3-lib

2025-10-13T06:28:42.225999827Z [inf] /nix/store/34z2792zyd4ayl5186vx0s98ckdaccz9-libidn2-2.3.7
/nix/store/2a3anh8vl3fcgk0fvaravlimrqawawza-libmpc-1.3.1

2025-10-13T06:28:42.226002346Z [inf] /nix/store/8675pnfr4fqnwv4pzjl67hdwls4q13aa-libssh2-1.11.1
/nix/store/d7zhcrcc7q3yfbm3qkqpgc3daq82spwi-libssh2-1.11.1-dev

2025-10-13T06:28:42.226012792Z [inf] /nix/store/xcqcgqazykf6s7fsn08k0blnh0wisdcl-libunistring-1.3
/nix/store/r9ac2hwnmb0nxwsrvr6gi9wsqf2whfqj-libuv-1.49.2

2025-10-13T06:28:42.22602254Z [inf] /nix/store/ll14czvpxglf6nnwmmrmygplm830fvlv-libuv-1.49.2-dev
/nix/store/6cr0spsvymmrp1hj5n0kbaxw55w1lqyp-libxcrypt-4.4.36

2025-10-13T06:28:42.226031372Z [inf] /nix/store/pc74azbkr19rkd5bjalq2xwx86cj3cga-linux-headers-6.12
/nix/store/fv7gpnvg922frkh81w5hkdhpz0nw3iiz-mirrors-list

2025-10-13T06:28:42.226038819Z [inf] /nix/store/qs22aazzrdd4dnjf9vffl0n31hvls43h-mpfr-4.2.1
/nix/store/grixvx878884hy8x3xs0c0s1i00j632k-nghttp2-1.64.0

2025-10-13T06:28:42.226049827Z [inf] /nix/store/dz97fw51rm5bl9kz1vg0haj1j1a7r1mr-nghttp2-1.64.0-dev
/nix/store/qcghigzrz56vczwlzg9c02vbs6zr9jkz-nghttp2-1.64.0-lib

2025-10-13T06:28:42.226052322Z [inf] /nix/store/fkyp1bm5gll9adnfcj92snyym524mdrj-nodejs-22.11.0

2025-10-13T06:28:42.226054402Z [inf] /nix/store/9l9n7a0v4aibcz0sgd0crs209an9p7dz-openssl-3.3.2

2025-10-13T06:28:42.226070577Z [inf] /nix/store/h1ydpxkw9qhjdxjpic1pdc2nirggyy6f-openssl-3.3.2
/nix/store/lygl27c44xv73kx1spskcgvzwq7z337c-openssl-3.3.2-bin

2025-10-13T06:28:42.226076785Z [inf] /nix/store/qq5q0alyzywdazhmybi7m69akz0ppk05-openssl-3.3.2-bin
/nix/store/kqm7wpqkzc4bwjlzqizcbz0mgkj06a9x-openssl-3.3.2-dev
/nix/store/pp2zf8bdgyz60ds8vcshk2603gcjgp72-openssl-3.3.2-dev

2025-10-13T06:28:42.22608942Z [inf] /nix/store/5yja5dpk2qw1v5mbfbl2d7klcdfrh90w-patch-2.7.6
/nix/store/srfxqk119fijwnprgsqvn68ys9kiw0bn-patchelf-0.15.0
/nix/store/3j1p598fivxs69wx3a657ysv3rw8k06l-pcre2-10.44
/nix/store/1i003ijlh9i0mzp6alqby5hg3090pjdx-perl-5.40.0
/nix/store/dj96qp9vps02l3n8xgc2vallqa9rhafb-sqlite-3.47.0

2025-10-13T06:28:42.226099935Z [inf] /nix/store/yc39wvfz87i0bl8r6vnhq48n6clbx2pb-sqlite-3.47.0-bin
/nix/store/i47d0rzbbnihcxkcaj48jgii5pj58djc-sqlite-3.47.0-dev

2025-10-13T06:28:42.226108472Z [inf] /nix/store/4ig84cyqi6qy4n0sanrbzsw1ixa497jx-stdenv-linux
/nix/store/d0gfdcag8bxzvg7ww4s7px4lf8sxisyx-stdenv-linux

2025-10-13T06:28:42.226118394Z [inf] /nix/store/d29r1bdmlvwmj52apgcdxfl1mm9c5782-update-autotools-gnu-config-scripts-hook
/nix/store/acfkqzj5qrqs88a4a6ixnybbjxja663d-xgcc-14-20241116-libgcc

2025-10-13T06:28:42.226125323Z [inf] /nix/store/c2njy6bv84kw1i4bjf5k5gn7gz8hn57n-xz-5.6.3
/nix/store/h18s640fnhhj2qdh5vivcfbxvz377srg-xz-5.6.3-bin

2025-10-13T06:28:42.22613246Z [inf] /nix/store/cqlaa2xf6lslnizyj9xqa8j0ii1yqw0x-zlib-1.3.1
/nix/store/1lggwqzapn5mn49l9zy4h566ysv9kzdb-zlib-1.3.1-dev

2025-10-13T06:28:42.23137809Z [inf] copying path '/nix/store/wf5zj2gbib3gjqllkabxaw4dh0gzcla3-builder.pl' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.236689121Z [inf] copying path '/nix/store/17v0ywnr3akp85pvdi56gwl99ljv95kx-gcc-14-20241116-libgcc' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.236697565Z [inf] copying path '/nix/store/1m67ipsk39xvhyqrxnzv2m2p48pil8kl-gnu-config-2024-01-01' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.237224982Z [inf] copying path '/nix/store/acfkqzj5qrqs88a4a6ixnybbjxja663d-xgcc-14-20241116-libgcc' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.237510958Z [inf] copying path '/nix/store/xcqcgqazykf6s7fsn08k0blnh0wisdcl-libunistring-1.3' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.240673216Z [inf] copying path '/nix/store/pc74azbkr19rkd5bjalq2xwx86cj3cga-linux-headers-6.12' from 'https://cache.nixos.org'...
copying path '/nix/store/fv7gpnvg922frkh81w5hkdhpz0nw3iiz-mirrors-list' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.241350275Z [inf] copying path '/nix/store/agvks3qmzja0yj54szi3vja6vx3cwkkw-curl-8.11.0-man' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.241962405Z [inf] copying path '/nix/store/grixvx878884hy8x3xs0c0s1i00j632k-nghttp2-1.64.0' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.24225091Z [inf] copying path '/nix/store/d29r1bdmlvwmj52apgcdxfl1mm9c5782-update-autotools-gnu-config-scripts-hook' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.283954724Z [inf] copying path '/nix/store/34z2792zyd4ayl5186vx0s98ckdaccz9-libidn2-2.3.7' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.298918964Z [inf] copying path '/nix/store/65h17wjrrlsj2rj540igylrx7fqcd6vq-glibc-2.40-36' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.867763155Z [inf] copying path '/nix/store/a9jgnlhkjkxav6qrc3rzg2q84pkl2wvr-attr-2.5.2' from 'https://cache.nixos.org'...
copying path '/nix/store/5mh7kaj2fyv8mk4sfq1brwxgc02884wi-bash-5.2p37' from 'https://cache.nixos.org'...
copying path '/nix/store/ivl2v8rgg7qh1jkj5pwpqycax3rc2hnl-bzip2-1.0.8' from 'https://cache.nixos.org'...
copying path '/nix/store/74h4z8k82pmp24xryflv4lxkz8jlpqqd-ed-1.20.2' from 'https://cache.nixos.org'...
copying path '/nix/store/qbry6090vlr9ar33kdmmbq2p5apzbga8-expand-response-params' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.867832006Z [inf] copying path '/nix/store/a3c47r5z1q2c4rz0kvq8hlilkhx2s718-gawk-5.3.1' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.867859695Z [inf] copying path '/nix/store/bpq1s72cw9qb2fs8mnmlw6hn2c7iy0ss-gcc-14-20241116-lib' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.867896517Z [inf] copying path '/nix/store/1c6bmxrrhm8bd26ai2rjqld2yyjrxhds-glibc-2.40-36-bin' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.868303804Z [inf] copying path '/nix/store/kryrg7ds05iwcmy81amavk8w13y4lxbs-gmp-6.3.0' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.868397726Z [inf] copying path '/nix/store/fp6cjl1zcmm6mawsnrb5yak1wkz2ma8l-gnumake-4.4.1' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.868411743Z [inf] copying path '/nix/store/abm77lnrkrkb58z6xp1qwjcr1xgkcfwm-gnused-4.9' from 'https://cache.nixos.org'...
copying path '/nix/store/2wh1gqyzf5xsvxpdz2k0bxiz583wwq29-keyutils-1.6.3-lib' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.868503534Z [inf] copying path '/nix/store/r9ac2hwnmb0nxwsrvr6gi9wsqf2whfqj-libuv-1.49.2' from 'https://cache.nixos.org'...
copying path '/nix/store/6cr0spsvymmrp1hj5n0kbaxw55w1lqyp-libxcrypt-4.4.36' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.868538351Z [inf] copying path '/nix/store/qcghigzrz56vczwlzg9c02vbs6zr9jkz-nghttp2-1.64.0-lib' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.868598912Z [inf] copying path '/nix/store/9l9n7a0v4aibcz0sgd0crs209an9p7dz-openssl-3.3.2' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.910341179Z [inf] copying path '/nix/store/h1ydpxkw9qhjdxjpic1pdc2nirggyy6f-openssl-3.3.2' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.911652979Z [inf] copying path '/nix/store/3j1p598fivxs69wx3a657ysv3rw8k06l-pcre2-10.44' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.912131676Z [inf] copying path '/nix/store/5yja5dpk2qw1v5mbfbl2d7klcdfrh90w-patch-2.7.6' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.91671502Z [inf] copying path '/nix/store/mglixp03lsp0w986svwdvm7vcy17rdax-bzip2-1.0.8-bin' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.917643162Z [inf] copying path '/nix/store/c2njy6bv84kw1i4bjf5k5gn7gz8hn57n-xz-5.6.3' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.918132147Z [inf] copying path '/nix/store/cf7gkacyxmm66lwl5nj6j6yykbrg4q5c-acl-2.3.2' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.92040165Z [inf] copying path '/nix/store/cqlaa2xf6lslnizyj9xqa8j0ii1yqw0x-zlib-1.3.1' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.9222568Z [inf] copying path '/nix/store/dz97fw51rm5bl9kz1vg0haj1j1a7r1mr-nghttp2-1.64.0-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.927189835Z [inf] copying path '/nix/store/ll14czvpxglf6nnwmmrmygplm830fvlv-libuv-1.49.2-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.929431425Z [inf] copying path '/nix/store/9cwwj1c9csmc85l2cqzs3h9hbf1vwl6c-gnutar-1.35' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.932534866Z [inf] copying path '/nix/store/xmbv8s4p4i4dbxgkgdrdfb0ym25wh6gk-isl-0.20' from 'https://cache.nixos.org'...
copying path '/nix/store/qs22aazzrdd4dnjf9vffl0n31hvls43h-mpfr-4.2.1' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.932855351Z [inf] copying path '/nix/store/df2a8k58k00f2dh2x930dg6xs6g6mliv-binutils-2.43.1-lib' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.933067003Z [inf] copying path '/nix/store/c4rj90r2m89rxs64hmm857mipwjhig5d-file-5.46' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.933278392Z [inf] copying path '/nix/store/dj96qp9vps02l3n8xgc2vallqa9rhafb-sqlite-3.47.0' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.938607516Z [inf] copying path '/nix/store/yc39wvfz87i0bl8r6vnhq48n6clbx2pb-sqlite-3.47.0-bin' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.944854608Z [inf] copying path '/nix/store/1lggwqzapn5mn49l9zy4h566ysv9kzdb-zlib-1.3.1-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.946670237Z [inf] copying path '/nix/store/nvvj6sk0k6px48436drlblf4gafgbvzr-gzip-1.13' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.946935777Z [inf] copying path '/nix/store/h18s640fnhhj2qdh5vivcfbxvz377srg-xz-5.6.3-bin' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.957257487Z [inf] copying path '/nix/store/aap6cq56amx4mzbyxp2wpgsf1kqjcr1f-gnugrep-3.11' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.967031694Z [inf] copying path '/nix/store/2a3anh8vl3fcgk0fvaravlimrqawawza-libmpc-1.3.1' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.970077578Z [inf] copying path '/nix/store/kj8hbqx4ds9qm9mq7hyikxyfwwg13kzj-glibc-2.40-36-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:42.99250106Z [inf] copying path '/nix/store/i47d0rzbbnihcxkcaj48jgii5pj58djc-sqlite-3.47.0-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.065501251Z [inf] copying path '/nix/store/j7p46r8v9gcpbxx89pbqlh61zhd33gzv-binutils-2.43.1' from 'https://cache.nixos.org'...
copying path '/nix/store/l89iqc7am6i60y8vk507zwrzxf0wcd3v-gcc-14-20241116' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.065515415Z [inf] copying path '/nix/store/a2byxfv4lc8f2g5xfzw8cz5q8k05wi29-gmp-with-cxx-6.3.0' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.065554666Z [inf] copying path '/nix/store/wwipgdqb4p2fr46kmw9c5wlk799kbl68-icu4c-74.2' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.065561062Z [inf] copying path '/nix/store/srfxqk119fijwnprgsqvn68ys9kiw0bn-patchelf-0.15.0' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.080991015Z [inf] copying path '/nix/store/lygl27c44xv73kx1spskcgvzwq7z337c-openssl-3.3.2-bin' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.090671717Z [inf] copying path '/nix/store/4s9rah4cwaxflicsk5cndnknqlk9n4p3-coreutils-9.5' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.093918712Z [inf] copying path '/nix/store/v9c1s50x7magpiqgycxxkn36avzbcg0g-krb5-1.21.3-lib' from 'https://cache.nixos.org'...
copying path '/nix/store/8675pnfr4fqnwv4pzjl67hdwls4q13aa-libssh2-1.11.1' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.093960513Z [inf] copying path '/nix/store/qq5q0alyzywdazhmybi7m69akz0ppk05-openssl-3.3.2-bin' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.112577919Z [inf] copying path '/nix/store/pp2zf8bdgyz60ds8vcshk2603gcjgp72-openssl-3.3.2-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.129447373Z [inf] copying path '/nix/store/kqm7wpqkzc4bwjlzqizcbz0mgkj06a9x-openssl-3.3.2-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.14328041Z [inf] copying path '/nix/store/00g69vw7c9lycy63h45ximy0wmzqx5y6-diffutils-3.10' from 'https://cache.nixos.org'...
copying path '/nix/store/jqrz1vq5nz4lnv9pqzydj0ir58wbjfy1-findutils-4.10.0' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.143297003Z [inf] copying path '/nix/store/1i003ijlh9i0mzp6alqby5hg3090pjdx-perl-5.40.0' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.16703421Z [inf] copying path '/nix/store/pkc7mb4a4qvyz73srkqh4mwl70w98dsv-curl-8.11.0' from 'https://cache.nixos.org'...
copying path '/nix/store/milph81dilrh96isyivh5n50agpx39k2-krb5-1.21.3' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.180399302Z [inf] copying path '/nix/store/d7zhcrcc7q3yfbm3qkqpgc3daq82spwi-libssh2-1.11.1-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.183371336Z [inf] copying path '/nix/store/4ig84cyqi6qy4n0sanrbzsw1ixa497jx-stdenv-linux' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.221784524Z [inf] building '/nix/store/cjdjkmr6gy2h8l0cra71whgrvy030kx1-libraries.drv'...

2025-10-13T06:28:43.224113561Z [inf] copying path '/nix/store/p123cq20klajcl9hj8jnkjip5nw6awhz-curl-8.11.0-bin' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.22701233Z [inf] copying path '/nix/store/b56mswksrql15knpb1bnhv3ysif340kd-krb5-1.21.3-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.256366103Z [inf] copying path '/nix/store/5f5linrxzhhb3mrclkwdpm9bd8ygldna-curl-8.11.0-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.356417845Z [inf] building '/nix/store/bs6g8vhkfynvlzidhlqbsvnc9wijbaaz-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7-env.drv'...

2025-10-13T06:28:43.384395228Z [inf] building '/nix/store/6vy68gykpxfphbmmyd59ya88xvrwvvaa-npm-9.9.4.tgz.drv'...

2025-10-13T06:28:43.598955246Z [inf] copying path '/nix/store/srcmmqi8kxjfygd0hyy42c8hv6cws83b-binutils-wrapper-2.43.1' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.605329923Z [inf]  
trying https://registry.npmjs.org/npm/-/npm-9.9.4.tgz

2025-10-13T06:28:43.608550553Z [inf] % Total % Received % Xferd Average Speed Time Time Time Current

2025-10-13T06:28:43.608625557Z [inf] Dload Upload Total Spent Left Speed

2025-10-13T06:28:43.659891458Z [inf] 100 2648k 100 2648k 0 0 50.3M 0 --:--:-- --:--:-- --:--:-- 49.7M

2025-10-13T06:28:43.852766302Z [inf] copying path '/nix/store/m8w3mf0i4862q22bxad0wspkgdy4jnkk-icu4c-74.2-dev' from 'https://cache.nixos.org'...

2025-10-13T06:28:43.946558568Z [inf] copying path '/nix/store/fkyp1bm5gll9adnfcj92snyym524mdrj-nodejs-22.11.0' from 'https://cache.nixos.org'...

2025-10-13T06:28:47.129660964Z [inf] copying path '/nix/store/xcn9p4xxfbvlkpah7pwchpav4ab9d135-gcc-wrapper-14-20241116' from 'https://cache.nixos.org'...

2025-10-13T06:28:47.137651851Z [inf] copying path '/nix/store/d0gfdcag8bxzvg7ww4s7px4lf8sxisyx-stdenv-linux' from 'https://cache.nixos.org'...

2025-10-13T06:28:47.16517469Z [inf] building '/nix/store/w9h0z1lhfwxc0m38f3w5brfdqrzm4wyj-npm.drv'...

2025-10-13T06:28:47.207976297Z [inf] Running phase: unpackPhase

2025-10-13T06:28:47.211867757Z [inf] unpacking source archive /nix/store/fkd1ma3nify8r9wp463yg5rqz9hdcyf1-npm-9.9.4.tgz

2025-10-13T06:28:47.296615275Z [inf] source root is package

2025-10-13T06:28:47.329621993Z [inf] setting SOURCE_DATE_EPOCH to timestamp 499162500 of file package/package.json

2025-10-13T06:28:47.333633302Z [inf] Running phase: installPhase

2025-10-13T06:28:47.824222702Z [inf] building '/nix/store/zr34yihblp8zqam2fjahiiddvnii8gw0-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7-env.drv'...

2025-10-13T06:28:47.883169023Z [inf] created 33 symlinks in user environment

2025-10-13T06:28:47.953310879Z [inf] building '/nix/store/540448vk4llinjrj8arqg9x2kb5l721g-user-environment.drv'...

2025-10-13T06:28:48.051559597Z [inf] removing old generations of profile /nix/var/nix/profiles/per-user/root/profile

2025-10-13T06:28:48.051628887Z [inf] removing profile version 1

2025-10-13T06:28:48.051799185Z [inf] removing old generations of profile /nix/var/nix/profiles/per-user/root/channels

2025-10-13T06:28:48.051959311Z [inf] removing old generations of profile /nix/var/nix/profiles/per-user/root/profile

2025-10-13T06:28:48.052046125Z [inf] removing old generations of profile /nix/var/nix/profiles/per-user/root/channels

2025-10-13T06:28:48.054623233Z [inf] finding garbage collector roots...

2025-10-13T06:28:48.054726521Z [inf] removing stale link from '/nix/var/nix/gcroots/auto/lzjbmb2ry0z7lma2fvpqprb12921pnb5' to '/nix/var/nix/profiles/per-user/root/profile-1-link'

2025-10-13T06:28:48.059156991Z [inf] deleting garbage...

2025-10-13T06:28:48.061377176Z [inf] deleting '/nix/store/a9qf4wwhympzs35ncp80r185j6a21w07-user-environment'

2025-10-13T06:28:48.061809673Z [inf] deleting '/nix/store/253kwn1730vnay87xkjgxa2v97w3y079-user-environment.drv'

2025-10-13T06:28:48.061916896Z [inf] deleting '/nix/store/hn5mrh362n52x8wwab9s1v6bgn4n5c94-env-manifest.nix'

2025-10-13T06:28:48.076181452Z [inf] deleting '/nix/store/d0gfdcag8bxzvg7ww4s7px4lf8sxisyx-stdenv-linux'

2025-10-13T06:28:48.076351198Z [inf] deleting '/nix/store/xcn9p4xxfbvlkpah7pwchpav4ab9d135-gcc-wrapper-14-20241116'

2025-10-13T06:28:48.076725506Z [inf] deleting '/nix/store/l89iqc7am6i60y8vk507zwrzxf0wcd3v-gcc-14-20241116'

2025-10-13T06:28:48.088379615Z [inf] deleting '/nix/store/2a3anh8vl3fcgk0fvaravlimrqawawza-libmpc-1.3.1'

2025-10-13T06:28:48.088640605Z [inf] deleting '/nix/store/xmbv8s4p4i4dbxgkgdrdfb0ym25wh6gk-isl-0.20'

2025-10-13T06:28:48.089354386Z [inf] deleting '/nix/store/4ig84cyqi6qy4n0sanrbzsw1ixa497jx-stdenv-linux'

2025-10-13T06:28:48.089651655Z [inf] deleting '/nix/store/srcmmqi8kxjfygd0hyy42c8hv6cws83b-binutils-wrapper-2.43.1'

2025-10-13T06:28:48.089939866Z [inf] deleting '/nix/store/kj8hbqx4ds9qm9mq7hyikxyfwwg13kzj-glibc-2.40-36-dev'

2025-10-13T06:28:48.093479625Z [inf] deleting '/nix/store/1c6bmxrrhm8bd26ai2rjqld2yyjrxhds-glibc-2.40-36-bin'

2025-10-13T06:28:48.09419948Z [inf] deleting '/nix/store/5f5linrxzhhb3mrclkwdpm9bd8ygldna-curl-8.11.0-dev'

2025-10-13T06:28:48.094551235Z [inf] deleting '/nix/store/p123cq20klajcl9hj8jnkjip5nw6awhz-curl-8.11.0-bin'

2025-10-13T06:28:48.094649133Z [inf] deleting '/nix/store/pkc7mb4a4qvyz73srkqh4mwl70w98dsv-curl-8.11.0'

2025-10-13T06:28:48.094783859Z [inf] deleting '/nix/store/d7zhcrcc7q3yfbm3qkqpgc3daq82spwi-libssh2-1.11.1-dev'

2025-10-13T06:28:48.09498388Z [inf] deleting '/nix/store/kqm7wpqkzc4bwjlzqizcbz0mgkj06a9x-openssl-3.3.2-dev'

2025-10-13T06:28:48.096118895Z [inf] deleting '/nix/store/qq5q0alyzywdazhmybi7m69akz0ppk05-openssl-3.3.2-bin'

2025-10-13T06:28:48.096253257Z [inf] deleting '/nix/store/8675pnfr4fqnwv4pzjl67hdwls4q13aa-libssh2-1.11.1'

2025-10-13T06:28:48.096410887Z [inf] deleting '/nix/store/b56mswksrql15knpb1bnhv3ysif340kd-krb5-1.21.3-dev'

2025-10-13T06:28:48.097000671Z [inf] deleting '/nix/store/milph81dilrh96isyivh5n50agpx39k2-krb5-1.21.3'

2025-10-13T06:28:48.097712192Z [inf] deleting '/nix/store/v9c1s50x7magpiqgycxxkn36avzbcg0g-krb5-1.21.3-lib'

2025-10-13T06:28:48.098328254Z [inf] deleting '/nix/store/9l9n7a0v4aibcz0sgd0crs209an9p7dz-openssl-3.3.2'

2025-10-13T06:28:48.098663397Z [inf] deleting '/nix/store/j7p46r8v9gcpbxx89pbqlh61zhd33gzv-binutils-2.43.1'

2025-10-13T06:28:48.101364382Z [inf] deleting '/nix/store/abm77lnrkrkb58z6xp1qwjcr1xgkcfwm-gnused-4.9'

2025-10-13T06:28:48.102911576Z [inf] deleting '/nix/store/5yja5dpk2qw1v5mbfbl2d7klcdfrh90w-patch-2.7.6'

2025-10-13T06:28:48.103148914Z [inf] deleting '/nix/store/agvks3qmzja0yj54szi3vja6vx3cwkkw-curl-8.11.0-man'

2025-10-13T06:28:48.103371035Z [inf] deleting '/nix/store/srfxqk119fijwnprgsqvn68ys9kiw0bn-patchelf-0.15.0'

2025-10-13T06:28:48.103695525Z [inf] deleting '/nix/store/aap6cq56amx4mzbyxp2wpgsf1kqjcr1f-gnugrep-3.11'

2025-10-13T06:28:48.105369648Z [inf] deleting '/nix/store/3j1p598fivxs69wx3a657ysv3rw8k06l-pcre2-10.44'

2025-10-13T06:28:48.105624665Z [inf] deleting '/nix/store/jqrz1vq5nz4lnv9pqzydj0ir58wbjfy1-findutils-4.10.0'

2025-10-13T06:28:48.107217169Z [inf] deleting '/nix/store/fkd1ma3nify8r9wp463yg5rqz9hdcyf1-npm-9.9.4.tgz'

2025-10-13T06:28:48.107422873Z [inf] deleting '/nix/store/qs22aazzrdd4dnjf9vffl0n31hvls43h-mpfr-4.2.1'

2025-10-13T06:28:48.107534722Z [inf] deleting '/nix/store/kryrg7ds05iwcmy81amavk8w13y4lxbs-gmp-6.3.0'

2025-10-13T06:28:48.107764599Z [inf] deleting '/nix/store/1i003ijlh9i0mzp6alqby5hg3090pjdx-perl-5.40.0'

2025-10-13T06:28:48.123093656Z [inf] deleting '/nix/store/pc74azbkr19rkd5bjalq2xwx86cj3cga-linux-headers-6.12'

2025-10-13T06:28:48.130013447Z [inf] deleting '/nix/store/mglixp03lsp0w986svwdvm7vcy17rdax-bzip2-1.0.8-bin'

2025-10-13T06:28:48.131546262Z [inf] deleting '/nix/store/dz97fw51rm5bl9kz1vg0haj1j1a7r1mr-nghttp2-1.64.0-dev'

2025-10-13T06:28:48.131839752Z [inf] deleting '/nix/store/na4c03201p0gmhn3bqr089x0xqia157w-source'

2025-10-13T06:28:48.13234824Z [inf] deleting '/nix/store/qbry6090vlr9ar33kdmmbq2p5apzbga8-expand-response-params'

2025-10-13T06:28:48.132530894Z [inf] deleting '/nix/store/6cr0spsvymmrp1hj5n0kbaxw55w1lqyp-libxcrypt-4.4.36'

2025-10-13T06:28:48.132750137Z [inf] deleting '/nix/store/wf5zj2gbib3gjqllkabxaw4dh0gzcla3-builder.pl'

2025-10-13T06:28:48.132866202Z [inf] deleting '/nix/store/9cwwj1c9csmc85l2cqzs3h9hbf1vwl6c-gnutar-1.35'

2025-10-13T06:28:48.134421005Z [inf] deleting '/nix/store/df2a8k58k00f2dh2x930dg6xs6g6mliv-binutils-2.43.1-lib'

2025-10-13T06:28:48.134741183Z [inf] deleting '/nix/store/lwi59jcfwk2lnrakmm1y5vw85hj3n1bi-source'

2025-10-13T06:28:48.899068163Z [inf] deleting '/nix/store/grixvx878884hy8x3xs0c0s1i00j632k-nghttp2-1.64.0'

2025-10-13T06:28:48.899248526Z [inf] deleting '/nix/store/d29r1bdmlvwmj52apgcdxfl1mm9c5782-update-autotools-gnu-config-scripts-hook'

2025-10-13T06:28:48.899352337Z [inf] deleting '/nix/store/1m67ipsk39xvhyqrxnzv2m2p48pil8kl-gnu-config-2024-01-01'

2025-10-13T06:28:48.899545001Z [inf] deleting '/nix/store/h18s640fnhhj2qdh5vivcfbxvz377srg-xz-5.6.3-bin'

2025-10-13T06:28:48.899936202Z [inf] deleting '/nix/store/c2njy6bv84kw1i4bjf5k5gn7gz8hn57n-xz-5.6.3'

2025-10-13T06:28:48.900982242Z [inf] deleting '/nix/store/00g69vw7c9lycy63h45ximy0wmzqx5y6-diffutils-3.10'

2025-10-13T06:28:48.902482139Z [inf] deleting '/nix/store/qcghigzrz56vczwlzg9c02vbs6zr9jkz-nghttp2-1.64.0-lib'

2025-10-13T06:28:48.90265248Z [inf] deleting '/nix/store/a3c47r5z1q2c4rz0kvq8hlilkhx2s718-gawk-5.3.1'

2025-10-13T06:28:48.904079717Z [inf] deleting '/nix/store/ivl2v8rgg7qh1jkj5pwpqycax3rc2hnl-bzip2-1.0.8'

2025-10-13T06:28:48.904213484Z [inf] deleting '/nix/store/1c0dv2pdlshjz5kmjd4dfp3c96yncr23-libraries'

2025-10-13T06:28:48.904403227Z [inf] deleting '/nix/store/fv7gpnvg922frkh81w5hkdhpz0nw3iiz-mirrors-list'

2025-10-13T06:28:48.904593613Z [inf] deleting '/nix/store/74h4z8k82pmp24xryflv4lxkz8jlpqqd-ed-1.20.2'

2025-10-13T06:28:48.904919965Z [inf] deleting '/nix/store/fp6cjl1zcmm6mawsnrb5yak1wkz2ma8l-gnumake-4.4.1'

2025-10-13T06:28:48.906205968Z [inf] deleting '/nix/store/nvvj6sk0k6px48436drlblf4gafgbvzr-gzip-1.13'

2025-10-13T06:28:48.906501107Z [inf] deleting '/nix/store/2wh1gqyzf5xsvxpdz2k0bxiz583wwq29-keyutils-1.6.3-lib'

2025-10-13T06:28:48.906735095Z [inf] deleting '/nix/store/c4rj90r2m89rxs64hmm857mipwjhig5d-file-5.46'

2025-10-13T06:28:48.907096209Z [inf] deleting unused links...

2025-10-13T06:28:50.143850936Z [inf] note: currently hard linking saves 2.98 MiB

2025-10-13T06:28:50.182312643Z [inf] 61 store paths deleted, 559.40 MiB freed

2025-10-13T06:28:50.583274853Z [inf] [ 4/10] RUN nix-env -if .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix && nix-collect-garbage -d
2025-10-13T06:28:50.585020323Z [inf] [ 5/10] COPY . /app/.
2025-10-13T06:28:50.691667277Z [inf] [ 5/10] COPY . /app/.
2025-10-13T06:28:50.692814825Z [inf] [ 6/10] RUN npm ci
2025-10-13T06:28:50.84897332Z [inf] npm warn config production Use `--omit=dev` instead.

2025-10-13T06:28:55.543417573Z [inf] npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported

2025-10-13T06:28:56.057887926Z [inf] npm warn deprecated npmlog@5.0.1: This package is no longer supported.

2025-10-13T06:28:56.131894999Z [inf] npm warn deprecated multer@1.4.5-lts.2: Multer 1.x is impacted by a number of vulnerabilities, which have been patched in 2.x. You should upgrade to the latest 2.x version.

2025-10-13T06:28:56.489482227Z [inf] npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.

2025-10-13T06:28:56.662984331Z [inf] npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported

2025-10-13T06:28:56.911798336Z [inf] npm warn deprecated gauge@3.0.2: This package is no longer supported.

2025-10-13T06:28:57.289881768Z [inf] npm warn deprecated are-we-there-yet@2.0.0: This package is no longer supported.

2025-10-13T06:28:58.135242738Z [inf] npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead

2025-10-13T06:28:58.135665997Z [inf] npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead

2025-10-13T06:29:01.15388983Z [inf] npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.

2025-10-13T06:29:08.403116911Z [inf]

> servicebay-pm@1.0.0 prepare
> husky install

2025-10-13T06:29:08.44054468Z [inf] husky - install command is DEPRECATED

2025-10-13T06:29:08.440846733Z [inf] .git can't be found
2025-10-13T06:29:08.457189166Z [inf]  
added 1239 packages, and audited 1243 packages in 18s

2025-10-13T06:29:08.457203688Z [inf]  
262 packages are looking for funding
run `npm fund` for details

2025-10-13T06:29:08.477042987Z [inf]  
8 vulnerabilities (6 moderate, 1 high, 1 critical)

To address all issues possible (including breaking changes), run:
npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.

2025-10-13T06:29:08.773929623Z [inf] [ 6/10] RUN npm ci
2025-10-13T06:29:08.775958419Z [inf] [ 7/10] COPY . /app/.
2025-10-13T06:29:09.089551565Z [inf] [ 7/10] COPY . /app/.
2025-10-13T06:29:09.090937815Z [inf] [ 8/10] RUN npm install && cd server && rm -rf node_modules/.prisma node_modules/@prisma/client && npx prisma generate && cd .. && npm run build
2025-10-13T06:29:09.247751816Z [inf] npm warn config production Use `--omit=dev` instead.

2025-10-13T06:29:13.725794158Z [inf]

> servicebay-pm@1.0.0 prepare
> husky install

2025-10-13T06:29:13.760586645Z [inf] husky - install command is DEPRECATED

2025-10-13T06:29:13.760948016Z [inf] .git can't be found
2025-10-13T06:29:13.769456388Z [inf]  
up to date, audited 1243 packages in 5s

2025-10-13T06:29:13.76946998Z [inf] 262 packages are looking for funding

2025-10-13T06:29:13.76951078Z [inf] run `npm fund` for details

2025-10-13T06:29:13.790788095Z [inf]  
8 vulnerabilities (6 moderate, 1 high, 1 critical)

To address all issues possible (including breaking changes), run:
npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.

2025-10-13T06:29:13.909699205Z [inf] npm warn config production Use `--omit=dev` instead.

2025-10-13T06:29:14.621019685Z [inf] Prisma schema loaded from prisma/schema.prisma

2025-10-13T06:29:15.1129511Z [inf]  
✔ Generated Prisma Client (v5.22.0) to ./../node_modules/@prisma/client in 124ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Easily identify and fix slow SQL queries in your app. Optimize helps you enhance your visibility: https://pris.ly/--optimize

2025-10-13T06:29:15.407002439Z [inf] npm warn config production Use `--omit=dev` instead.

2025-10-13T06:29:15.42811074Z [inf]

> servicebay-pm@1.0.0 build
> npm run prisma:generate && npm run build --workspaces

2025-10-13T06:29:15.509773098Z [inf] npm warn config production Use `--omit=dev` instead.

2025-10-13T06:29:15.530876555Z [inf]

> servicebay-pm@1.0.0 prisma:generate
> cd server && npx prisma generate

2025-10-13T06:29:15.641994359Z [inf] npm warn config production Use `--omit=dev` instead.

2025-10-13T06:29:16.327708094Z [inf] Prisma schema loaded from prisma/schema.prisma

2025-10-13T06:29:16.808638684Z [inf]  
✔ Generated Prisma Client (v5.22.0) to ./../node_modules/@prisma/client in 144ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Help us improve the Prisma ORM for everyone. Share your feedback in a short 2-min survey: https://pris.ly/orm/survey/release-5-22

2025-10-13T06:29:16.826315164Z [inf] ┌─────────────────────────────────────────────────────────┐
│ Update available 5.22.0 -> 6.17.1 │
│ │
│ This is a major update - please follow the guide at │
│ https://pris.ly/d/major-version-upgrade │
│ │
│ Run the following to update │
│ npm i --save-dev prisma@latest │
│ npm i @prisma/client@latest │
└─────────────────────────────────────────────────────────┘

2025-10-13T06:29:17.107215793Z [inf] npm warn config production Use `--omit=dev` instead.

2025-10-13T06:29:17.14681144Z [inf]

> server@1.0.0 build
> tsc && tsc-alias

2025-10-13T06:29:25.695907413Z [inf] src/sync/service.ts(1043,13): error TS2322: Type '"useDb" | "useSheet" | "merge"' is not assignable to type '"skip" | "useDb" | "useSheet" | "needsResolution"'.
Type '"merge"' is not assignable to type '"skip" | "useDb" | "useSheet" | "needsResolution"'.

2025-10-13T06:29:25.766020044Z [inf] npm error Lifecycle script `build` failed with error:

2025-10-13T06:29:25.766056826Z [inf] npm error code 2

2025-10-13T06:29:25.76620653Z [inf] npm error path /app/server
npm error workspace server@1.0.0

2025-10-13T06:29:25.766216331Z [inf] npm error location /app/server

2025-10-13T06:29:25.766240963Z [inf] npm error command failed

2025-10-13T06:29:25.766266583Z [inf] npm error command sh -c tsc && tsc-alias

2025-10-13T06:29:25.766547149Z [inf]

2025-10-13T06:29:25.767281162Z [inf]

> client@1.0.0 build
> tsc && vite build

2025-10-13T06:29:30.498641879Z [inf] [36mvite v5.4.20 [32mbuilding for production...[36m[39m

2025-10-13T06:29:30.784129988Z [inf] transforming...

2025-10-13T06:29:32.906855649Z [inf] Deprecation [legacy-js-api]: The legacy JS API is deprecated and will be removed in Dart Sass 2.0.0.

More info: https://sass-lang.com/d/legacy-js-api

2025-10-13T06:29:33.076409551Z [inf] DEPRECATION WARNING [global-builtin]: Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0.
Use color.adjust instead.

More info and automated migrator: https://sass-lang.com/d/import

╷
96 │ fill: darken($bar-color, 5);
│ ^^^^^^^^^^^^^^^^^^^^^
╵
file:///app/node_modules/frappe-gantt/src/gantt.scss 96:11 root stylesheet

2025-10-13T06:29:33.076936363Z [inf] DEPRECATION WARNING [color-functions]: darken() is deprecated. Suggestions:

color.scale($color, $lightness: -6.5721649485%)
color.adjust($color, $lightness: -5%)

More info: https://sass-lang.com/d/color-functions

╷
96 │ fill: darken($bar-color, 5);
│ ^^^^^^^^^^^^^^^^^^^^^
╵
file:///app/node_modules/frappe-gantt/src/gantt.scss 96:11 root stylesheet

2025-10-13T06:29:33.077219177Z [inf] DEPRECATION WARNING [global-builtin]: Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0.
Use color.adjust instead.

More info and automated migrator: https://sass-lang.com/d/import

    ╷

100 │ fill: darken($blue, 5);
│ ^^^^^^^^^^^^^^^^
╵
file:///app/node_modules/frappe-gantt/src/gantt.scss 100:11 root stylesheet

2025-10-13T06:29:33.077428705Z [inf] DEPRECATION WARNING [color-functions]: darken() is deprecated. Suggestions:

color.scale($color, $lightness: -6.1004784689%)
color.adjust($color, $lightness: -5%)

More info: https://sass-lang.com/d/color-functions

    ╷

100 │ fill: darken($blue, 5);
│ ^^^^^^^^^^^^^^^^
╵
file:///app/node_modules/frappe-gantt/src/gantt.scss 100:11 root stylesheet

2025-10-13T06:29:33.077663286Z [inf] DEPRECATION WARNING [global-builtin]: Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0.
Use color.adjust instead.

More info and automated migrator: https://sass-lang.com/d/import

    ╷

111 │ fill: darken($bar-color, 5);
│ ^^^^^^^^^^^^^^^^^^^^^
╵
file:///app/node_modules/frappe-gantt/src/gantt.scss 111:11 root stylesheet

2025-10-13T06:29:33.077854513Z [inf] DEPRECATION WARNING [color-functions]: darken() is deprecated. Suggestions:

color.scale($color, $lightness: -6.5721649485%)
color.adjust($color, $lightness: -5%)

More info: https://sass-lang.com/d/color-functions

    ╷

111 │ fill: darken($bar-color, 5);
│ ^^^^^^^^^^^^^^^^^^^^^
╵
file:///app/node_modules/frappe-gantt/src/gantt.scss 111:11 root stylesheet

2025-10-13T06:29:33.078055197Z [inf] DEPRECATION WARNING [global-builtin]: Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0.
Use color.adjust instead.

More info and automated migrator: https://sass-lang.com/d/import

    ╷

115 │ fill: darken($blue, 5);
│ ^^^^^^^^^^^^^^^^
╵
file:///app/node_modules/frappe-gantt/src/gantt.scss 115:11 root stylesheet

2025-10-13T06:29:33.078185427Z [inf] DEPRECATION WARNING [color-functions]: darken() is deprecated. Suggestions:

color.scale($color, $lightness: -6.1004784689%)
color.adjust($color, $lightness: -5%)

More info: https://sass-lang.com/d/color-functions

    ╷

115 │ fill: darken($blue, 5);
│ ^^^^^^^^^^^^^^^^
╵
file:///app/node_modules/frappe-gantt/src/gantt.scss 115:11 root stylesheet

2025-10-13T06:29:36.14494494Z [inf] [32m✓[39m 3398 modules transformed.

2025-10-13T06:29:36.841217089Z [inf] rendering chunks...

2025-10-13T06:29:36.860772467Z [inf] computing gzip size...

2025-10-13T06:29:36.920977556Z [inf] [2mdist/[22m[32mindex.html [39m[1m[2m 0.67 kB[22m[1m[22m[2m │ gzip: 0.38 kB[22m
[2mdist/[22m[2massets/[22m[35mindex-CajnPoRB.css [39m[1m[2m 52.68 kB[22m[1m[22m[2m │ gzip: 9.95 kB[22m

2025-10-13T06:29:36.921068526Z [inf] [2mdist/[22m[2massets/[22m[36mindex-BnvFCLwZ.js [39m[1m[33m1,748.35 kB[39m[22m[2m │ gzip: 484.44 kB[22m

2025-10-13T06:29:36.921144439Z [inf] [33m
(!) Some chunks are larger than 500 kB after minification. Consider:

- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m

2025-10-13T06:29:36.921428729Z [inf] [32m✓ built in 6.40s[39m

2025-10-13T06:29:36.979176573Z [inf]

> shared@1.0.0 build
> echo "Shared workspace - no build needed (TypeScript only)"

2025-10-13T06:29:36.981435353Z [inf] Shared workspace - no build needed (TypeScript only)

2025-10-13T06:29:37.029163075Z [err] [ 8/10] RUN npm install && cd server && rm -rf node_modules/.prisma node_modules/@prisma/client && npx prisma generate && cd .. && npm run build
2025-10-13T06:29:37.042829400Z [err] Dockerfile:24
2025-10-13T06:29:37.042863124Z [err] -------------------
2025-10-13T06:29:37.042867941Z [err] 22 | # build phase
2025-10-13T06:29:37.042871777Z [err] 23 | COPY . /app/.
2025-10-13T06:29:37.042878555Z [err] 24 | >>> RUN npm install && cd server && rm -rf node_modules/.prisma node_modules/@prisma/client && npx prisma generate && cd .. && npm run build
2025-10-13T06:29:37.042882017Z [err] 25 |
2025-10-13T06:29:37.042885358Z [err] 26 |
2025-10-13T06:29:37.042888583Z [err] -------------------
2025-10-13T06:29:37.042892583Z [err] ERROR: failed to build: failed to solve: process "/bin/bash -ol pipefail -c npm install && cd server && rm -rf node_modules/.prisma node_modules/@prisma/client && npx prisma generate && cd .. && npm run build" did not complete successfully: exit code: 2
2025-10-13T06:29:37.048820393Z [err] Error: Docker build failed
