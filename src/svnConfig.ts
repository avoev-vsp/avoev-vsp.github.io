const config: any = {
  projects: [
    // {
    //   name: 'Public-SVN',
    //   url: 'public-svn',
    //   description: 'VSP',
    //   svn: 'https://svn.vsp.tu-berlin.de/repos/public-svn/matsim/scenarios/countries/',
    //   need_password: false,
    //   thumbnail: '/tu-logo.png',
    // },
    // {
    //   name: 'Local Files',
    //   url: 'local',
    //   description: 'Use scripts/serve.py',
    //   svn: 'http://localhost/',
    //   need_password: true,
    //   thumbnail: '/tu-logo.png',
    // },
    {
      name: 'Gladbeck',
      url: 'gladbeck',
      description: 'AVÖV Projekt: Gladbeck NRW',
      svn:
        'https://svn.vsp.tu-berlin.de/repos/public-svn/matsim/scenarios/countries/de/gladbeck/avoev/',
      need_password: false,
      thumbnail: '/thumb-gladbeck.jpg',
    },
    {
      name: 'Vulkaneifel',
      url: 'vulkaneifel',
      description: 'AVÖV Projekt: Vulkaneifel RP',
      svn:
        'https://svn.vsp.tu-berlin.de/repos/public-svn/matsim/scenarios/countries/de/vulkaneifel/avoev/',
      need_password: false,
      thumbnail: '/thumb-vulkaneifel.jpg',
    },
  ],
}

export default config
